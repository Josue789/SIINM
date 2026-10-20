import Dexie, { type EntityTable } from 'dexie'
import type { Medicine, InventoryMovement } from '../types/inventory.types'
import type { SyncQueueItem } from '../types/sync.types'

/**
 * Base de Datos local Dexie para Offline-First.
 * Todas las operaciones de lectura y escritura ocurren aquí primero.
 */
export class SIINMDatabase extends Dexie {
  medicines!: EntityTable<Medicine, 'id'>
  inventoryMovements!: EntityTable<InventoryMovement, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>

  constructor() {
    super('SIINM_OfflineDB')
    
    this.version(1).stores({
      medicines: 'id, code, name, category, expirationDate, updatedAt',
      inventoryMovements: 'id, medicineId, type, createdAt',
      syncQueue: 'id, tableName, action, recordId, status, createdAt',
    })
  }
}

// Instancia singleton para toda la aplicación
export const db = new SIINMDatabase()
