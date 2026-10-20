import { supabase } from '../services/supabase/client'
import { syncQueueRepository } from '../db/repositories/syncQueue.repository'
import { networkWatcher } from './networkWatcher'
import { db } from '../db'
import type { SyncQueueItem } from '../types/sync.types'

class SyncEngine {
  private isSyncing = false
  private lastSyncAt: string | null = null

  constructor() {
    // Sincronizar automáticamente al recuperar conexión a internet
    networkWatcher.subscribe((isOnline) => {
      if (isOnline) {
        this.syncAll().catch(console.error)
      }
    })
  }

  /**
   * Ejecuta el ciclo completo de sincronización bidireccional:
   * 1. Push: envía cambios locales pendientes a Supabase.
   * 2. Pull: descarga novedades desde Supabase a Dexie.
   */
  async syncAll(): Promise<{ pushed: number; failed: number }> {
    if (this.isSyncing || !networkWatcher.isOnline) {
      return { pushed: 0, failed: 0 }
    }

    this.isSyncing = true
    let pushed = 0
    let failed = 0

    try {
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

      // 2. PULL: Descargar actualizaciones de Supabase si aplica
      await this.pullRemoteChanges()

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
        const { error } = await supabase.from(item.tableName).insert(item.payload)
        if (error) throw error
      } else if (item.action === 'update') {
        const { error } = await supabase
          .from(item.tableName)
          .update(item.payload)
          .eq('id', item.recordId)
        if (error) throw error
      } else if (item.action === 'delete') {
        const { error } = await supabase
          .from(item.tableName)
          .delete()
          .eq('id', item.recordId)
        if (error) throw error
      }
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al sincronizar'
      await syncQueueRepository.markAsFailed(item.id, msg)
      return false
    }
  }

  private async pullRemoteChanges(): Promise<void> {
    try {
      // Ejemplo de Pull para la tabla 'medicines'
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .limit(100)

      if (error || !data) return

      // Upsert masivo en Dexie
      await db.medicines.bulkPut(data)
    } catch {
      // Si no hay conexión o no existe la tabla remota aún, se continúa sin romper la app
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
