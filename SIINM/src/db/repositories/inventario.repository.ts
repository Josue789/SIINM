import { db } from '../index'
import { supabase } from '@/services/supabase/client'
import { syncQueueRepository } from './syncQueue.repository'
import type { InventarioItem } from '@/types/inventory.types'
import { v4 as uuidv4 } from 'uuid'

export interface AddInventarioEntryDTO {
  id_clinica: number
  id_medicamento: number | string
  lote: string
  stock: number
  fecha_caducidad: string
  medicamento?: string
  clave_ssa?: string
  codigo_barras?: string
  presentacion?: string
}

export const inventarioRepository = {
  /**
   * Obtiene todos los registros del inventario desde Dexie.
   */
  async getAll(): Promise<InventarioItem[]> {
    return await db.inventario.toArray()
  },

  /**
   * Obtiene el inventario local filtrado por ID de clínica.
   */
  async getByClinica(idClinica: number): Promise<InventarioItem[]> {
    return await db.inventario.where('id_clinica').equals(idClinica).toArray()
  },

  /**
   * Registra una o varias entradas de insumos médicos en:
   * 1. Tabla local 'inventario' de Dexie.
   * 2. Tabla 'medicines' y bitácora 'inventoryMovements' de Dexie.
   * 3. Tabla 'Inventario' de Supabase (o encola en syncQueue si está offline).
   */
  async addEntries(entries: AddInventarioEntryDTO[]): Promise<void> {
    const now = new Date().toISOString()

    for (const entry of entries) {
      const loteTrimmed = entry.lote.trim()
      const stockNum = Number(entry.stock) || 0
      const medIdParsed = !isNaN(Number(entry.id_medicamento))
        ? Number(entry.id_medicamento)
        : entry.id_medicamento

      // 1. Guardar o actualizar en Dexie local (tabla 'inventario')
      // Buscamos si ya existe el mismo medicamento y lote para esta clínica
      const existingLocal = await db.inventario
        .filter(
          (item) =>
            item.id_clinica === entry.id_clinica &&
            String(item.id_medicamento) === String(entry.id_medicamento) &&
            item.lote.toLowerCase() === loteTrimmed.toLowerCase()
        )
        .first()

      let localRecordId = uuidv4()

      if (existingLocal && existingLocal.id) {
        localRecordId = String(existingLocal.id)
        const updatedStock = Number(existingLocal.stock) + stockNum
        await db.inventario.update(existingLocal.id, {
          stock: updatedStock,
          update_date: now,
          fecha_caducidad: entry.fecha_caducidad || existingLocal.fecha_caducidad,
        })
      } else {
        const newLocalItem: InventarioItem = {
          id: localRecordId,
          id_clinica: entry.id_clinica,
          id_medicamento: medIdParsed,
          lote: loteTrimmed,
          stock: stockNum,
          fecha_caducidad: entry.fecha_caducidad,
          update_date: now,
          medicamento: entry.medicamento,
          clave_ssa: entry.clave_ssa,
          codigo_barras: entry.codigo_barras,
          presentacion: entry.presentacion,
        }
        await db.inventario.put(newLocalItem)
      }

      // 2. Registrar movimiento en bitácora local
      await db.inventoryMovements.add({
        id: uuidv4(),
        medicineId: String(entry.id_medicamento),
        type: 'in',
        quantity: stockNum,
        reason: `Entrada de insumos - Lote ${loteTrimmed}`,
        createdAt: now,
      })

      // 3. Actualizar / agregar en db.medicines para retrocompatibilidad con la vista de inventario
      const existingMedicine = await db.medicines.get(String(entry.id_medicamento))
      if (existingMedicine) {
        await db.medicines.update(existingMedicine.id, {
          stock: (existingMedicine.stock || 0) + stockNum,
          batchNumber: loteTrimmed,
          expirationDate: entry.fecha_caducidad,
          updatedAt: now,
        })
      }

      // 4. Guardar o actualizar en Supabase (tabla 'Inventario')
      const payload: Record<string, unknown> = {
        id_clinica: Number(entry.id_clinica),
        id_medicamento: medIdParsed,
        lote: loteTrimmed,
        stock: stockNum,
        fecha_caducidad: entry.fecha_caducidad,
        update_date: now,
      }

      try {
        // Verificar si ya existe en Supabase para acumular stock
        const { data: existingRemote, error: fetchErr } = await supabase
          .from('Inventario')
          .select('id, stock')
          .eq('id_clinica', entry.id_clinica)
          .eq('id_medicamento', medIdParsed)
          .eq('lote', loteTrimmed)
          .maybeSingle()

        if (!fetchErr && existingRemote) {
          const newRemoteStock = Number(existingRemote.stock) + stockNum
          const updatePayload = {
            stock: newRemoteStock,
            update_date: now,
            fecha_caducidad: entry.fecha_caducidad,
          }
          const { error: updateErr } = await supabase
            .from('Inventario')
            .update(updatePayload)
            .eq('id', existingRemote.id)

          if (updateErr) {
            console.warn('[inventarioRepository] Error al actualizar en Supabase, encolando offline:', updateErr.message)
            await syncQueueRepository.enqueue('Inventario', 'update', String(existingRemote.id), updatePayload)
          }
        } else {
          const { error: insertErr } = await supabase.from('Inventario').insert(payload)
          if (insertErr) {
            console.warn('[inventarioRepository] Error al insertar en Supabase, encolando offline:', insertErr.message)
            await syncQueueRepository.enqueue('Inventario', 'insert', localRecordId, payload)
          }
        }
      } catch (err) {
        console.warn('[inventarioRepository] Sin conexión directa con Supabase, encolando offline:', err)
        await syncQueueRepository.enqueue('Inventario', 'insert', localRecordId, payload)
      }
    }
  },

  /**
   * Sube a Supabase todos los registros locales de db.inventario que aún no existan en la BD remota.
   */
  async pushUnsyncedLocal(): Promise<number> {
    const localItems = await db.inventario.toArray()
    if (!localItems || localItems.length === 0) return 0

    let uploaded = 0
    for (const item of localItems) {
      try {
        const medIdParsed = !isNaN(Number(item.id_medicamento))
          ? Number(item.id_medicamento)
          : item.id_medicamento

        const { data: existing } = await supabase
          .from('Inventario')
          .select('id, stock')
          .eq('id_clinica', item.id_clinica)
          .eq('id_medicamento', medIdParsed)
          .eq('lote', item.lote)
          .maybeSingle()

        if (!existing) {
          const payload = {
            id_clinica: Number(item.id_clinica),
            id_medicamento: medIdParsed,
            lote: item.lote,
            stock: Number(item.stock),
            fecha_caducidad: item.fecha_caducidad,
            update_date: item.update_date || new Date().toISOString(),
          }
          const { error } = await supabase.from('Inventario').insert(payload)
          if (!error) uploaded++
        }
      } catch (e) {
        console.warn('[inventarioRepository] Error subiendo item local a Supabase:', e)
      }
    }
    return uploaded
  },

  /**
   * Descarga los registros de la tabla 'Inventario' de Supabase y los guarda en Dexie.
   */
  async pullFromRemote(idClinica?: number): Promise<number> {
    try {
      let query = supabase.from('Inventario').select('*').order('id', { ascending: true })
      if (idClinica) {
        query = query.eq('id_clinica', idClinica)
      }

      const { data, error } = await query
      if (error || !data) return 0

      const catalog = await db.catalogo_medicamentos.toArray()
      const catalogMap = new Map(catalog.map((c) => [String(c.id), c]))

      const formatted: InventarioItem[] = (data as Array<Record<string, unknown>>).map((d) => {
        const medId = (d.id_medicamento as string | number) || ''
        const med = catalogMap.get(String(medId))
        return {
          id: d.id as string | number,
          id_clinica: Number(d.id_clinica),
          id_medicamento: medId,
          lote: (d.lote as string) || '00000',
          stock: Number(d.stock) || 0,
          fecha_caducidad: (d.fecha_caducidad as string) || 'N/A',
          update_date: (d.update_date as string) || new Date().toISOString(),
          medicamento: med?.medicamento || '',
          clave_ssa: med?.clave_ssa || '',
          presentacion: med?.presentacion || 'Pieza',
          codigo_barras: med?.codigo_barras || '',
        }
      })

      if (formatted.length > 0) {
        await db.inventario.bulkPut(formatted)
      }
      return formatted.length
    } catch (err) {
      console.warn('[inventarioRepository] Error al descargar inventario de Supabase:', err)
      return 0
    }
  },

  /**
   * Elimina un registro de inventario en Dexie y en Supabase (o encola si está offline).
   */
  async delete(id: number | string): Promise<void> {
    await db.inventario.delete(id as unknown as string)
    await db.medicines.delete(String(id))

    try {
      const { error } = await supabase.from('Inventario').delete().eq('id', id)
      if (error) {
        console.warn('[inventarioRepository] Error al eliminar en Supabase, encolando offline:', error.message)
        await syncQueueRepository.enqueue('Inventario', 'delete', String(id), {})
      }
    } catch (err) {
      console.warn('[inventarioRepository] Sin conexión directa con Supabase, encolando eliminación offline:', err)
      await syncQueueRepository.enqueue('Inventario', 'delete', String(id), {})
    }
  },
}
