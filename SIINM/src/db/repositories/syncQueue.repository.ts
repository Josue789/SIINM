import { db } from '../index'
import type { SyncQueueItem, SyncAction } from '../../types/sync.types'
import { v4 as uuidv4 } from 'uuid'

export const syncQueueRepository = {
  /**
   * Encola una acción para ser sincronizada con Supabase cuando haya conexión.
   */
  async enqueue<T = Record<string, unknown>>(
    tableName: string,
    action: SyncAction,
    recordId: string,
    payload: T
  ): Promise<SyncQueueItem<T>> {
    const item: SyncQueueItem<T> = {
      id: uuidv4(),
      tableName,
      action,
      recordId,
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    }

    await db.syncQueue.add(item as unknown as SyncQueueItem)
    return item
  },

  /**
   * Obtiene todos los cambios locales pendientes de sincronizar.
   */
  async getPending(): Promise<SyncQueueItem[]> {
    return await db.syncQueue
      .where('status')
      .equals('pending')
      .sortBy('createdAt')
  },

  /**
   * Cuenta cuántos elementos quedan pendientes en cola.
   */
  async countPending(): Promise<number> {
    return await db.syncQueue
      .where('status')
      .equals('pending')
      .count()
  },

  /**
   * Marca un ítem como sincronizado (o lo elimina si se desea una cola limpia).
   */
  async markAsSynced(id: string): Promise<void> {
    await db.syncQueue.delete(id)
  },

  /**
   * Registra un fallo en el intento de sincronización.
   */
  async markAsFailed(id: string, errorMsg: string): Promise<void> {
    const existing = await db.syncQueue.get(id)
    if (existing) {
      await db.syncQueue.update(id, {
        status: existing.attempts >= 4 ? 'failed' : 'pending',
        attempts: existing.attempts + 1,
        lastError: errorMsg,
      })
    }
  },
}
