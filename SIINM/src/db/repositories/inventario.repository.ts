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
   * Limpia y desduplica registros en Dexie (db.inventario).
   * Si existen registros con la misma clínica, medicamento y lote:
   * Conserva el que tenga ID numérico remoto (proveniente de Supabase),
   * y elimina los duplicados con IDs temporales (UUID).
   */
  async deduplicateLocal(): Promise<void> {
    try {
      const items = await db.inventario.toArray()
      if (!items || items.length === 0) return

      const groups = new Map<string, InventarioItem[]>()
      for (const item of items) {
        const medKey = String(item.id_medicamento || item.clave_ssa || '').trim().toLowerCase()
        const loteKey = String(item.lote || '').trim().toLowerCase()
        const key = `${item.id_clinica}-${medKey}-${loteKey}`
        const group = groups.get(key) || []
        group.push(item)
        groups.set(key, group)
      }

      for (const [, group] of groups.entries()) {
        if (group.length > 1) {
          // Clasificar entre registros remotos (ID numérico) y temporales (UUID)
          const remoteRecords = group.filter(
            (g) => typeof g.id === 'number' || (!isNaN(Number(g.id)) && !String(g.id).includes('-'))
          )
          const temporaryRecords = group.filter(
            (g) => isNaN(Number(g.id)) || String(g.id).includes('-')
          )

          let canonical: InventarioItem
          const toDelete: (string | number)[] = []

          if (remoteRecords.length > 0) {
            // Ordenar por ID descendente
            remoteRecords.sort((a, b) => Number(b.id) - Number(a.id))
            canonical = remoteRecords[0]
            toDelete.push(...remoteRecords.slice(1).map((r) => r.id!))
            toDelete.push(...temporaryRecords.map((t) => t.id!))
          } else {
            canonical = group[0]
            toDelete.push(...group.slice(1).map((g) => g.id!))
          }

          for (const delId of toDelete) {
            if (delId !== undefined && delId !== canonical.id) {
              await db.inventario.delete(delId as unknown as string)
              if (!isNaN(Number(delId))) {
                await db.inventario.delete(Number(delId))
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[inventarioRepository] Error desduplicando inventario local:', err)
    }
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
            (String(item.id_medicamento) === String(entry.id_medicamento) ||
              Boolean(item.clave_ssa && entry.clave_ssa && item.clave_ssa === entry.clave_ssa)) &&
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
          } else {
            // Si el registro local tenía ID temporal o diferente, reconciliarlo con el ID de Supabase
            if (localRecordId !== String(existingRemote.id)) {
              await db.inventario.delete(localRecordId)
              const current = await db.inventario.get(existingRemote.id)
              await db.inventario.put({
                ...(current || {}),
                id: existingRemote.id,
                id_clinica: entry.id_clinica,
                id_medicamento: medIdParsed,
                lote: loteTrimmed,
                stock: newRemoteStock,
                fecha_caducidad: entry.fecha_caducidad,
                update_date: now,
                medicamento: entry.medicamento,
                clave_ssa: entry.clave_ssa,
                codigo_barras: entry.codigo_barras,
                presentacion: entry.presentacion,
              })
            }
          }
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('Inventario')
            .insert(payload)
            .select()

          if (insertErr) {
            console.warn('[inventarioRepository] Error al insertar en Supabase, encolando offline:', insertErr.message)
            await syncQueueRepository.enqueue('Inventario', 'insert', localRecordId, payload)
          } else if (inserted && inserted[0]) {
            // Reemplazar ID temporal con ID real de Supabase
            const remoteId = inserted[0].id
            if (localRecordId !== String(remoteId)) {
              await db.inventario.delete(localRecordId)
              await db.inventario.put({
                id: remoteId,
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
              })
            }
          }
        }
      } catch (err) {
        console.warn('[inventarioRepository] Sin conexión directa con Supabase, encolando offline:', err)
        await syncQueueRepository.enqueue('Inventario', 'insert', localRecordId, payload)
      }
    }

    await this.deduplicateLocal()
  },

  /**
   * Sube a Supabase todos los registros locales de db.inventario que aún no existan en la BD remota.
   */
  async pushUnsyncedLocal(): Promise<number> {
    const localItems = await db.inventario.toArray()
    if (!localItems || localItems.length === 0) return 0

    let uploaded = 0
    for (const item of localItems) {
      // Solo consideramos registros que tengan un ID local temporal (UUID / no puramente numérico)
      const isTemporaryId = isNaN(Number(item.id)) || String(item.id).includes('-')
      if (!isTemporaryId) continue

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
          const { data: inserted, error } = await supabase.from('Inventario').insert(payload).select()
          if (!error && inserted && inserted[0]) {
            if (item.id) {
              await db.inventario.delete(item.id)
            }
            await db.inventario.put({
              ...item,
              id: inserted[0].id,
            })
            uploaded++
          }
        } else {
          // Ya existe en remoto: acumular stock y reemplazar el registro local temporal
          const updatedStock = Number(existing.stock) + Number(item.stock)
          await supabase
            .from('Inventario')
            .update({
              stock: updatedStock,
              update_date: new Date().toISOString(),
              fecha_caducidad: item.fecha_caducidad,
            })
            .eq('id', existing.id)

          if (item.id) {
            await db.inventario.delete(item.id)
          }
          await db.inventario.put({
            ...item,
            id: existing.id,
            stock: updatedStock,
          })
          uploaded++
        }
      } catch (e) {
        console.warn('[inventarioRepository] Error subiendo item local a Supabase:', e)
      }
    }

    await this.deduplicateLocal()
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
        await this.deduplicateLocal()
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
    if (!isNaN(Number(id))) {
      await db.inventario.delete(Number(id))
    }
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

  /**
   * Actualiza el stock de un medicamento en Dexie y en Supabase (o encola si está offline).
   * Soporta tanto `quantityDispensed` (cantidad a descontar) como `newStock` (nuevo stock final).
   */
  async updateStock({
    recordId,
    newStock,
    quantityDispensed,
    reason,
  }: {
    recordId: number | string
    newStock?: number
    quantityDispensed?: number
    reason: string
  }): Promise<void> {
    const now = new Date().toISOString()

    // 1. Buscar en Dexie local considerando tanto clave numérica como string (UUID)
    const parsedId: number | string =
      !isNaN(Number(recordId)) && !String(recordId).includes('-')
        ? Number(recordId)
        : recordId

    let existingLocal = await db.inventario.get(parsedId as any)
    if (!existingLocal && parsedId !== recordId) {
      existingLocal = await db.inventario.get(recordId as any)
    }

    if (!existingLocal) {
      existingLocal = await db.inventario.filter((item) => String(item.id) === String(recordId)).first()
    }

    if (!existingLocal || existingLocal.id === undefined) {
      throw new Error(`Registro de inventario no encontrado en Dexie local: ${recordId}`)
    }

    // Determinar la cantidad a descontar y el nuevo stock restante
    const currentStock = Number(existingLocal.stock) || 0
    let dispensedNum = 0
    let finalStock = currentStock

    if (quantityDispensed !== undefined) {
      dispensedNum = Number(quantityDispensed) || 0
      finalStock = Math.max(0, currentStock - dispensedNum)
    } else if (newStock !== undefined) {
      finalStock = Math.max(0, Number(newStock) || 0)
      dispensedNum = Math.max(0, currentStock - finalStock)
    }

    // 1. En Dexie local: actualizar primero el stock (incluso si es 0)
    await db.inventario.update(existingLocal.id, {
      stock: finalStock,
      update_date: now,
    })

    // 2. Registrar el movimiento en la bitácora local ('out')
    await db.inventoryMovements.add({
      id: uuidv4(),
      medicineId: String(existingLocal.id_medicamento),
      type: 'out',
      quantity: dispensedNum || 1,
      reason: reason || `Receta médica - Lote ${existingLocal.lote}`,
      createdAt: now,
    })

    // 3. Actualizar en db.medicines para retrocompatibilidad
    const existingMedicine = await db.medicines.get(String(existingLocal.id_medicamento))
    if (existingMedicine) {
      const medCurrentStock = Number(existingMedicine.stock) || 0
      const medNewStock = Math.max(0, medCurrentStock - dispensedNum)
      await db.medicines.update(existingMedicine.id, {
        stock: medNewStock,
        batchNumber: existingLocal.lote,
        expirationDate: existingLocal.fecha_caducidad,
        updatedAt: now,
      })
    }

    // 4. Guardar o actualizar en Supabase
    let remoteId: number | string | null =
      typeof existingLocal.id === 'number' ||
      (!isNaN(Number(existingLocal.id)) && !String(existingLocal.id).includes('-'))
        ? Number(existingLocal.id)
        : null

    // Si el ID local era un UUID temporal, buscar su ID real numérico en Supabase
    if (!remoteId) {
      try {
        const medIdParsed = !isNaN(Number(existingLocal.id_medicamento))
          ? Number(existingLocal.id_medicamento)
          : existingLocal.id_medicamento

        const { data: remoteRecord } = await supabase
          .from('Inventario')
          .select('id')
          .eq('id_clinica', Number(existingLocal.id_clinica))
          .eq('id_medicamento', medIdParsed)
          .eq('lote', String(existingLocal.lote || '').trim())
          .maybeSingle()

        if (remoteRecord && remoteRecord.id) {
          remoteId = remoteRecord.id
        }
      } catch (e) {
        console.warn('[inventarioRepository] Error buscando ID remoto en Supabase:', e)
      }
    }

    const targetId = remoteId || existingLocal.id
    const payload: Record<string, unknown> = {
      stock: finalStock,
      update_date: now,
    }

    try {
      // Paso 1: SIEMPRE actualizar el stock en Supabase (incluso si llega a 0) para que el descuento quede aplicado
      const { error: updateError } = await supabase
        .from('Inventario')
        .update(payload)
        .eq('id', targetId)

      if (updateError) {
        console.warn(
          '[inventarioRepository] Error al actualizar stock en Supabase, encolando offline:',
          updateError.message
        )
        await syncQueueRepository.enqueue('Inventario', 'update', String(targetId), payload)
      }

      // Paso 2: Si el stock llegó a 0 o menos, intentar además eliminar el registro en Supabase
      if (finalStock <= 0) {
        const { error: deleteError } = await supabase
          .from('Inventario')
          .delete()
          .eq('id', targetId)

        if (deleteError) {
          console.warn(
            '[inventarioRepository] Supabase no permitió eliminar el registro (posible restricción RLS o FK), pero el stock ya quedó descontado en 0:',
            deleteError.message
          )
        } else {
          // Si Supabase sí eliminó el registro exitosamente, también lo removemos por completo de Dexie
          await db.inventario.delete(existingLocal.id as unknown as string)
          if (!isNaN(Number(existingLocal.id))) {
            await db.inventario.delete(Number(existingLocal.id))
          }
        }
      }
    } catch (err) {
      // Sin conexión directa con Supabase: encolar según corresponda
      await syncQueueRepository.enqueue('Inventario', 'update', String(targetId), payload)
      if (finalStock <= 0) {
        await syncQueueRepository.enqueue('Inventario', 'delete', String(targetId), {})
      }
      console.warn('[inventarioRepository] Sin conexión directa con Supabase, encolando operación offline:', err)
    }
  }
}
