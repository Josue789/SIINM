import { supabase } from '../services/supabase/client'
import { syncQueueRepository } from '../db/repositories/syncQueue.repository'
import { networkWatcher } from './networkWatcher'
import { db } from '../db'
import type { SyncQueueItem } from '../types/sync.types'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
        .channel('catalogo_medicamentos_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'catalogo_medicamentos',
          },
          (payload: any) => {
            console.log('[Supabase Realtime] Evento recibido:', payload.eventType, payload)
            this.handleRealtimeEvent(payload).catch(console.error)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] Conectado y escuchando cambios en catalogo_medicamentos')
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
  private async handleRealtimeEvent(payload: {
    eventType: string
    new: Record<string, any>
    old: Record<string, any>
  }) {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRecord || !newRecord.id) return

        const formatted = {
          ...newRecord,
          id: String(newRecord.id),
          clave_ssa: newRecord.clave_ssa || '',
          ssa: newRecord.clave_ssa || '',
          medicamento: newRecord.medicamento || '',
          name: newRecord.medicamento || '',
          presentacion: newRecord.presentacion || 'Pieza',
          codigo_barras: newRecord.codigo_barras || '',
          activo: newRecord.activo !== undefined ? Boolean(newRecord.activo) : true,
          estatus: newRecord.activo !== false ? 'Activo' : 'Inactivo',
          cantidadPorPieza: newRecord.cantidadPorPieza || 1,
        }

        if (db.catalogo_medicamentos) {
          await db.catalogo_medicamentos.put(formatted)
        }
        await db.medicines.put(formatted as any)
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
          await db.medicines?.put(formatted as any)
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
      // Pull para la tabla 'catalogo_medicamentos' de Supabase
      const { data, error } = await supabase
        .from('catalogo_medicamentos')
        .select('*')
        .order('id', { ascending: true })
        .limit(500)

      if (error) {
        console.error('[SyncEngine] Error al descargar catalogo_medicamentos de Supabase:', error.message, error)
        return
      }

      if (!data || data.length === 0) {
        console.log('[SyncEngine] catalogo_medicamentos en Supabase no tiene registros (o bloqueado por RLS).')
        return
      }

      // Formatear y asegurar tipos en Dexie
      const formatted = data.map((d: any) => ({
        ...d,
        id: String(d.id),
        clave_ssa: d.clave_ssa || d.ssa || '',
        ssa: d.clave_ssa || d.ssa || '',
        medicamento: d.medicamento || d.name || '',
        name: d.medicamento || d.name || '',
        presentacion: d.presentacion || 'Pieza',
        codigo_barras: d.codigo_barras || '',
        activo: d.activo !== undefined ? Boolean(d.activo) : true,
        estatus: d.activo !== false ? 'Activo' : 'Inactivo',
        cantidadPorPieza: d.cantidadPorPieza || 1,
      }))

      if (db.catalogo_medicamentos) {
        await db.catalogo_medicamentos.bulkPut(formatted)
      }
      await db.medicines.bulkPut(formatted as any)
      console.log(`[SyncEngine] Sincronizados ${formatted.length} medicamentos desde Supabase a Dexie.`)
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
