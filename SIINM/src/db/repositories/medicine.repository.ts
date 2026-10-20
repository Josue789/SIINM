import { db } from '../index'
import type { Medicine } from '../../types/inventory.types'
import { syncQueueRepository } from './syncQueue.repository'
import { v4 as uuidv4 } from 'uuid'

export const medicineRepository = {
  /**
   * Obtiene todos los medicamentos desde la BD local Dexie.
   */
  async getAll(): Promise<Medicine[]> {
    return await db.medicines.toArray()
  },

  /**
   * Obtiene un medicamento por ID desde Dexie.
   */
  async getById(id: string): Promise<Medicine | undefined> {
    return await db.medicines.get(id)
  },

  /**
   * Crea un medicamento localmente y encola la mutación para Supabase.
   */
  async create(data: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>): Promise<Medicine> {
    const now = new Date().toISOString()
    const newMedicine: Medicine = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      isLocalOnly: true,
    }

    // 1. Guardado inmediato en IndexedDB
    await db.medicines.add(newMedicine)

    // 2. Encolado para sincronización
    await syncQueueRepository.enqueue('medicines', 'insert', newMedicine.id, newMedicine)

    return newMedicine
  },

  /**
   * Actualiza un medicamento localmente y encola para Supabase.
   */
  async update(id: string, updates: Partial<Medicine>): Promise<void> {
    const now = new Date().toISOString()
    const payload = { ...updates, updatedAt: now }

    await db.medicines.update(id, payload)
    await syncQueueRepository.enqueue('medicines', 'update', id, payload)
  },

  /**
   * Elimina un medicamento localmente y encola la eliminación para Supabase.
   */
  async delete(id: string): Promise<void> {
    await db.medicines.delete(id)
    await syncQueueRepository.enqueue('medicines', 'delete', id, { id })
  },
}
