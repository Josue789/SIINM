import { supabase } from '../services/supabase/client'
import { syncQueueRepository } from '../db/repositories/syncQueue.repository'
import { inventarioRepository } from '../db/repositories/inventario.repository'
import { networkWatcher } from './networkWatcher'
import { db } from '../db'
import type { SyncQueueItem } from '../types/sync.types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Medicine, InventarioItem } from '../types/inventory.types'

interface RealtimePostgresPayload {
  eventType: string
  new: Record<string, unknown>
  old: Record<string, unknown>
}

class SyncEngine {
  private isSyncing = false
  private lastSyncAt: string | null = null
  private realtimeChannel: RealtimeChannel | null = null
  private hasInitialPulled = false

  constructor() {
    // Sincronizar automáticamente y conectar Realtime al recuperar conexión a internet
    networkWatcher.subscribe((isOnline) => {
      if (isOnline) {
        this.startRealtimeListener()
        this.syncAll().catch(console.error)
      } else {
        this.stopRealtimeListener()
      }
    })
  }

  /**
   * Conecta al canal Realtime de Supabase para escuchar cambios (INSERT, UPDATE, DELETE)
   * sin necesidad de hacer peticiones continuas (evita sobrecarga y peticiones DDoS).
   */
  startRealtimeListener(): void {
    if (this.realtimeChannel || !networkWatcher.isOnline) return

    try {
      this.realtimeChannel = supabase
        .channel('app_realtime_sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'catalogo_medicamentos',
          },
          (payload: RealtimePostgresPayload) => {
            console.log('[Supabase Realtime] catalogo_medicamentos:', payload.eventType, payload)
            this.handleRealtimeEvent(payload).catch(console.error)
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Inventario',
          },
          (payload: RealtimePostgresPayload) => {
            console.log('[Supabase Realtime] Inventario:', payload.eventType, payload)
            this.handleInventarioRealtimeEvent(payload).catch(console.error)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] Conectado y escuchando cambios en catalogo e inventario')
          }
        })
    } catch (err) {
      console.warn('[Supabase Realtime] No se pudo iniciar el canal:', err)
    }
  }

  /**
   * Detiene la escucha de eventos en tiempo real cuando se pierde la conexión.
   */
  stopRealtimeListener(): void {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel).catch(console.error)
      this.realtimeChannel = null
      console.log('[Supabase Realtime] Canal cerrado')
    }
  }

  /**
   * Procesa un cambio recibido vía WebSocket desde Supabase y actualiza Dexie en tiempo real.
   */
  private async handleRealtimeEvent(payload: RealtimePostgresPayload) {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRecord || !newRecord.id) return

        const formatted = {
          ...newRecord,
          id: String(newRecord.id),
          clave_ssa: (newRecord.clave_ssa as string) || '',
          ssa: (newRecord.clave_ssa as string) || '',
          medicamento: (newRecord.medicamento as string) || '',
          name: (newRecord.medicamento as string) || '',
          presentacion: (newRecord.presentacion as string) || 'Pieza',
          codigo_barras: (newRecord.codigo_barras as string) || '',
          activo: newRecord.activo !== undefined ? Boolean(newRecord.activo) : true,
          estatus: newRecord.activo !== false ? 'Activo' : 'Inactivo',
          cantidadPorPieza: (newRecord.cantidadPorPieza as number) || 1,
        }

        if (db.catalogo_medicamentos) {
          await db.catalogo_medicamentos.put(formatted)
        }
        await db.medicines.put(formatted as unknown as Medicine)
      } else if (eventType === 'DELETE') {
        const idToDelete = String(oldRecord?.id)
        if (idToDelete) {
          if (db.catalogo_medicamentos) {
            await db.catalogo_medicamentos.delete(idToDelete)
          }
          await db.medicines.delete(idToDelete)
        }
      }
    } catch (err) {
      console.error('[Supabase Realtime] Error aplicando evento en Dexie:', err)
    }
  }

  /**
   * Procesa un cambio recibido vía WebSocket para la tabla Inventario.
   */
  private async handleInventarioRealtimeEvent(payload: RealtimePostgresPayload) {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRecord || !newRecord.id) return

        let medicamento = ''
        let clave_ssa = ''
        let presentacion = 'Pieza'
        let codigo_barras = ''

        if (newRecord.id_medicamento && db.catalogo_medicamentos) {
          const med = await db.catalogo_medicamentos.get(String(newRecord.id_medicamento))
          if (med) {
            medicamento = med.medicamento || ''
            clave_ssa = med.clave_ssa || ''
            presentacion = med.presentacion || 'Pieza'
            codigo_barras = med.codigo_barras || ''
          }
        }

        const formatted: InventarioItem = {
          id: newRecord.id as number | string,
          id_clinica: Number(newRecord.id_clinica),
          id_medicamento: (newRecord.id_medicamento as number | string) || '',
          lote: (newRecord.lote as string) || '00000',
          stock: Number(newRecord.stock) || 0,
          fecha_caducidad: (newRecord.fecha_caducidad as string) || 'N/A',
          update_date: (newRecord.update_date as string) || new Date().toISOString(),
          medicamento,
          clave_ssa,
          presentacion,
          codigo_barras,
        }

        if (db.inventario) {
          // Si existía un registro temporal local para esta clínica, medicamento y lote, removerlo
          const loteTrimmed = String(newRecord.lote || '').trim()
          const localDups = await db.inventario
            .filter(
              (inv) =>
                inv.id_clinica === Number(newRecord.id_clinica) &&
                String(inv.id_medicamento) === String(newRecord.id_medicamento) &&
                inv.lote.toLowerCase() === loteTrimmed.toLowerCase() &&
                inv.id !== newRecord.id
            )
            .toArray()

          for (const dup of localDups) {
            if (dup.id) {
              await db.inventario.delete(dup.id as unknown as string)
              if (!isNaN(Number(dup.id))) {
                await db.inventario.delete(Number(dup.id))
              }
            }
          }

          await db.inventario.put(formatted)
        }
      } else if (eventType === 'DELETE') {
        const idToDelete = oldRecord?.id as string | number | undefined
        if (idToDelete && db.inventario) {
          await db.inventario.delete(idToDelete as unknown as string)
          if (!isNaN(Number(idToDelete))) {
            await db.inventario.delete(Number(idToDelete))
          }
        }
      }
    } catch (err) {
      console.error('[Supabase Realtime] Error aplicando evento de Inventario en Dexie:', err)
    }
  }

  /**
   * Ejecuta el ciclo de sincronización:
   * 1. Push: envía cambios locales pendientes a Supabase.
   * 2. Pull: descarga novedades iniciales o forzadas desde Supabase a Dexie.
   * Con Realtime activo, no se repiten descargas completas en cada push.
   */
  async syncAll(options: { forcePull?: boolean } = {}): Promise<{ pushed: number; failed: number }> {
    if (this.isSyncing || !networkWatcher.isOnline) {
      return { pushed: 0, failed: 0 }
    }

    this.isSyncing = true
    let pushed = 0
    let failed = 0

    try {
      // Si se fuerza la sincronización, reintentar elementos previamente fallidos
      if (options.forcePull) {
        await syncQueueRepository.retryAllFailed()
      }

      // 1. PUSH: Procesar cola de mutaciones
      const pendingItems = await syncQueueRepository.getPending()

      for (const item of pendingItems) {
        const success = await this.pushItem(item)
        if (success) {
          await syncQueueRepository.markAsSynced(item.id)
          pushed++
        } else {
          failed++
        }
      }

      // 2. PULL: Descarga inicial o forzada. Con Realtime ya conectado, no se requiere repetición
      if (!this.hasInitialPulled || options.forcePull) {
        await this.pullRemoteChanges()
        this.hasInitialPulled = true
      }

      this.lastSyncAt = new Date().toISOString()
    } catch (error) {
      console.warn('Sync cycle interrupted:', error)
    } finally {
      this.isSyncing = false
    }

    return { pushed, failed }
  }

  private async pushItem(item: SyncQueueItem): Promise<boolean> {
    try {
      if (item.action === 'insert') {
        if (item.tableName === 'Inventario') {
          const payload = item.payload as Record<string, unknown>
          const medIdParsed = !isNaN(Number(payload.id_medicamento))
            ? Number(payload.id_medicamento)
            : payload.id_medicamento
          const loteTrimmed = String(payload.lote || '').trim()

          // Verificar si ya existe en Supabase para acumular stock y evitar error de restricción unique
          const { data: existingRemote } = await supabase
            .from('Inventario')
            .select('id, stock')
            .eq('id_clinica', Number(payload.id_clinica))
            .eq('id_medicamento', medIdParsed)
            .eq('lote', loteTrimmed)
            .maybeSingle()

          let remote: Record<string, unknown> | null = null

          if (existingRemote) {
            const updatedStock = Number(existingRemote.stock) + (Number(payload.stock) || 0)
            const updatePayload = {
              stock: updatedStock,
              update_date: payload.update_date || new Date().toISOString(),
              fecha_caducidad: payload.fecha_caducidad,
            }
            const { data: updatedData, error: updateErr } = await supabase
              .from('Inventario')
              .update(updatePayload)
              .eq('id', existingRemote.id)
              .select()

            if (updateErr) {
              console.error('[SyncEngine] Error actualizando stock en Supabase:', updateErr.message, updateErr)
              throw updateErr
            }
            remote = (updatedData && updatedData[0]) || { ...existingRemote, ...updatePayload }
          } else {
            const { data, error } = await supabase.from(item.tableName).insert(item.payload).select()
            if (error) {
              console.error('[SyncEngine] Error en Supabase INSERT:', error.message, error)
              throw error
            }
            remote = data?.[0] || null
          }

          if (remote) {
            if (item.recordId !== String(remote.id)) {
              await db.inventario?.delete(item.recordId)
              if (!isNaN(Number(item.recordId))) {
                await db.inventario?.delete(Number(item.recordId))
              }
            }

            let medicamento = ''
            let clave_ssa = ''
            let presentacion = 'Pieza'
            let codigo_barras = ''

            if (remote.id_medicamento && db.catalogo_medicamentos) {
              const med = await db.catalogo_medicamentos.get(String(remote.id_medicamento))
              if (med) {
                medicamento = med.medicamento || ''
                clave_ssa = med.clave_ssa || ''
                presentacion = med.presentacion || 'Pieza'
                codigo_barras = med.codigo_barras || ''
              }
            }

            await db.inventario?.put({
              id: remote.id as number | string,
              id_clinica: Number(remote.id_clinica),
              id_medicamento: remote.id_medicamento as number | string,
              lote: (remote.lote as string) || '00000',
              stock: Number(remote.stock) || 0,
              fecha_caducidad: (remote.fecha_caducidad as string) || 'N/A',
              update_date: (remote.update_date as string) || new Date().toISOString(),
              medicamento,
              clave_ssa,
              presentacion,
              codigo_barras,
            })

            await inventarioRepository.deduplicateLocal()
          }
        } else {
          const { data, error } = await supabase.from(item.tableName).insert(item.payload).select()
          if (error) {
            console.error('[SyncEngine] Error en Supabase INSERT:', error.message, error)
            throw error
          }

          if (data && data[0] && item.tableName === 'catalogo_medicamentos') {
            const remote = data[0]
            if (item.recordId !== String(remote.id)) {
              await db.catalogo_medicamentos?.delete(item.recordId)
              await db.medicines?.delete(item.recordId)
            }
            const formatted = {
              ...remote,
              id: String(remote.id),
              clave_ssa: remote.clave_ssa || '',
              ssa: remote.clave_ssa || '',
              medicamento: remote.medicamento || '',
              name: remote.medicamento || '',
              presentacion: remote.presentacion || 'Pieza',
              activo: Boolean(remote.activo),
              estatus: remote.activo ? 'Activo' : 'Inactivo',
              cantidadPorPieza: remote.cantidadPorPieza || 1,
            }
            await db.catalogo_medicamentos?.put(formatted)
            await db.medicines?.put(formatted as unknown as Medicine)
          }
        }
      } else if (item.action === 'update') {
        const { error } = await supabase
          .from(item.tableName)
          .update(item.payload)
          .eq('id', item.recordId)
        if (error) {
          console.error('[SyncEngine] Error en Supabase UPDATE:', error.message, error)
          throw error
        }
      } else if (item.action === 'delete') {
        const { error } = await supabase
          .from(item.tableName)
          .delete()
          .eq('id', item.recordId)
        if (error) {
          console.error('[SyncEngine] Error en Supabase DELETE:', error.message, error)
          throw error
        }
      }
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al sincronizar'
      console.warn(`[SyncEngine] Falló sincronización de ${item.tableName} (${item.action}): ${msg}`)
      await syncQueueRepository.markAsFailed(item.id, msg)
      return false
    }
  }

  private async pullRemoteChanges(): Promise<void> {
    try {
      // 1. Pull para la tabla 'catalogo_medicamentos' de Supabase
      const { data, error } = await supabase
        .from('catalogo_medicamentos')
        .select('*')
        .order('id', { ascending: true })
        .limit(500)

      if (error) {
        console.error('[SyncEngine] Error al descargar catalogo_medicamentos de Supabase:', error.message, error)
      } else if (data && data.length > 0) {
        // Formatear y asegurar tipos en Dexie
        const formatted = data.map((d: Record<string, unknown>) => ({
          ...d,
          id: String(d.id),
          clave_ssa: (d.clave_ssa as string) || (d.ssa as string) || '',
          ssa: (d.clave_ssa as string) || (d.ssa as string) || '',
          medicamento: (d.medicamento as string) || (d.name as string) || '',
          name: (d.medicamento as string) || (d.name as string) || '',
          presentacion: (d.presentacion as string) || 'Pieza',
          codigo_barras: (d.codigo_barras as string) || '',
          activo: d.activo !== undefined ? Boolean(d.activo) : true,
          estatus: d.activo !== false ? 'Activo' : 'Inactivo',
          cantidadPorPieza: (d.cantidadPorPieza as number) || 1,
        }))

        if (db.catalogo_medicamentos) {
          await db.catalogo_medicamentos.bulkPut(formatted)
        }
        await db.medicines.bulkPut(formatted as unknown as Medicine[])
        console.log(`[SyncEngine] Sincronizados ${formatted.length} medicamentos desde Supabase a Dexie.`)
      }

      // 2. Pull para la tabla 'Inventario' de Supabase
      const { data: invData, error: invError } = await supabase
        .from('Inventario')
        .select('*')
        .order('id', { ascending: true })
        .limit(1000)

      if (invError) {
        console.error('[SyncEngine] Error al descargar Inventario de Supabase:', invError.message, invError)
      } else if (invData && invData.length > 0) {
        const catalog = (await db.catalogo_medicamentos?.toArray()) || []
        const catalogMap = new Map(catalog.map((c) => [String(c.id), c]))

        const formattedInv = invData.map((d: Record<string, unknown>) => {
          const medId = (d.id_medicamento as string | number) || ''
          const med = catalogMap.get(String(medId))
          return {
            id: d.id as number | string,
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

        if (db.inventario) {
          await db.inventario.bulkPut(formattedInv)
          await inventarioRepository.deduplicateLocal()
        }
        console.log(`[SyncEngine] Sincronizados ${formattedInv.length} registros de Inventario desde Supabase.`)
      }
    } catch (err) {
      console.error('[SyncEngine] Error inesperado en pullRemoteChanges:', err)
    }
  }

  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
    }
  }
}

export const syncEngine = new SyncEngine()
