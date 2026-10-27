import Dexie, { type EntityTable } from 'dexie'
import type { Medicine, InventoryMovement, CatalogoMedicamento, InventarioItem } from '../types/inventory.types'
import type { SyncQueueItem } from '../types/sync.types'

/**
 * Base de Datos local Dexie para Offline-First.
 * Todas las operaciones de lectura y escritura ocurren aquí primero.
 */
export class SIINMDatabase extends Dexie {
  catalogo_medicamentos!: EntityTable<CatalogoMedicamento, 'id'>
  medicines!: EntityTable<Medicine, 'id'>
  inventoryMovements!: EntityTable<InventoryMovement, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  inventario!: EntityTable<InventarioItem, 'id'>

  constructor() {
    super('SIINM_OfflineDB')
    
    this.version(1).stores({
      medicines: 'id, codigo_barras, clave_ssa, medicamento, presentacion, activo',
      inventoryMovements: 'id, medicineId, type, createdAt',
      syncQueue: 'id, tableName, action, recordId, status, createdAt',
    })

    this.version(2).stores({
      catalogo_medicamentos: 'id, codigo_barras, clave_ssa, medicamento, presentacion, activo',
    })

    this.version(3).stores({
      inventario: '++id, id_clinica, id_medicamento, lote, stock, fecha_caducidad, update_date',
    })
  }
}

// Instancia singleton para toda la aplicación
export const db = new SIINMDatabase()
