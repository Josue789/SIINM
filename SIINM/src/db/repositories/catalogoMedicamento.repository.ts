import { db } from '../index'
import type { CatalogoMedicamento } from '../../types/inventory.types'
import { syncQueueRepository } from './syncQueue.repository'
import { v4 as uuidv4 } from 'uuid'


export const catalogoMedicamentoRepository = {
  /**
   * Obtiene todos los medicamentos del catálogo desde la BD local Dexie.
   */
  async getAll(): Promise<CatalogoMedicamento[]> {
    const normalize = (item: any): CatalogoMedicamento => {
      const isActivo = item.activo !== undefined 
        ? Boolean(item.activo) 
        : item.estatus ? item.estatus.toLowerCase() === 'activo' : true

      const claveSsa = item.clave_ssa || item.ssa || item.code || ''
      const medName = item.medicamento || item.name || ''

      return {
        id: String(item.id || uuidv4()),
        codigo_barras: item.codigo_barras || item.barcode || '',
        clave_ssa: claveSsa,
        medicamento: medName,
        presentacion: item.presentacion || item.dosageForm || 'Pieza',
        activo: isActivo,
        ssa: claveSsa,
        estatus: isActivo ? 'Activo' : 'Inactivo',
        cantidadPorPieza: item.cantidadPorPieza || 1,
        isLocalOnly: item.isLocalOnly,
      }
    }

    try {
      const items = await db.catalogo_medicamentos.toArray()
      if (items && items.length > 0) {
        return items.map(normalize)
      }
      
      // Fallback a db.medicines si existen allí previamente
      const legacy = await db.medicines.toArray()
      if (legacy && legacy.length > 0) {
        return legacy.map(normalize)
      }

      
    } catch {
      
    }
  },

  /**
   * Obtiene un medicamento por ID desde Dexie.
   */
  async getById(id: string): Promise<CatalogoMedicamento | undefined> {
    try {
      const item = await db.catalogo_medicamentos.get(id)
      if (item) return item
      return (await db.medicines.get(id)) as unknown as CatalogoMedicamento | undefined
    } catch {
      return (await db.medicines.get(id)) as unknown as CatalogoMedicamento | undefined
    }
  },

  /**
   * Crea un medicamento en el catálogo localmente y encola la mutación para Supabase.
   */
  async create(data: Omit<CatalogoMedicamento, 'id'> & { id?: string }): Promise<CatalogoMedicamento> {
    
    // Evitar dupliciad de codigo de barras y/o clave ssa
    const existingMedicine = await this.getAll()
    const existingMedicineWithSameBarcode = existingMedicine.find(item => item.codigo_barras === data.codigo_barras)
    const existingMedicineWithSameSsa = existingMedicine.find(item => item.clave_ssa === data.clave_ssa)
    if (existingMedicineWithSameBarcode || existingMedicineWithSameSsa) {
      throw new Error('Clave ssa y/o codigo de barras duplicado')
    }

    // Procesa y agregar el medicamento a la bd local
    const isActivo = data.activo !== undefined ? data.activo : true
    const newMedicine: CatalogoMedicamento = {
      id: data.id || uuidv4(),
      codigo_barras: data.codigo_barras || '',
      clave_ssa: data.clave_ssa,
      medicamento: data.medicamento,
      presentacion: data.presentacion,
      activo: isActivo,
      ssa: data.clave_ssa,
      estatus: isActivo ? 'Activo' : 'Inactivo',
      cantidadPorPieza: data.cantidadPorPieza || 1,
      isLocalOnly: true,
    }

    // 1. Guardar en Dexie (ambas tablas para retrocompatibilidad total)
    await db.catalogo_medicamentos.put(newMedicine)
    await db.medicines.put(newMedicine as any)

    // 2. Encolar para sincronización con Supabase (columnas de catalogo_medicamentos)
    const payloadForSupabase: Record<string, unknown> = {
      codigo_barras: newMedicine.codigo_barras,
      clave_ssa: newMedicine.clave_ssa,
      medicamento: newMedicine.medicamento,
      presentacion: newMedicine.presentacion,
      activo: newMedicine.activo,
    }
    // Solo enviamos id si ya es un entero válido de Postgres
    if (!isNaN(Number(newMedicine.id)) && String(Number(newMedicine.id)) === String(newMedicine.id)) {
      payloadForSupabase.id = Number(newMedicine.id)
    }

    await syncQueueRepository.enqueue('catalogo_medicamentos', 'insert', newMedicine.id, payloadForSupabase)

    return newMedicine
  },

  /**
   * Actualiza un medicamento del catálogo localmente y encola para Supabase.
   */
  async update(id: string, updates: Partial<CatalogoMedicamento>): Promise<void> {
    const existing = await this.getById(id)
    const updated: CatalogoMedicamento = {
      id,
      codigo_barras: updates.codigo_barras ?? existing?.codigo_barras ?? '',
      clave_ssa: updates.clave_ssa ?? existing?.clave_ssa ?? '',
      medicamento: updates.medicamento ?? existing?.medicamento ?? '',
      presentacion: updates.presentacion ?? existing?.presentacion ?? '',
      activo: updates.activo !== undefined ? updates.activo : (existing?.activo ?? true),
      ssa: updates.clave_ssa ?? existing?.ssa,
      estatus: updates.activo !== undefined ? (updates.activo ? 'Activo' : 'Inactivo') : existing?.estatus,
      cantidadPorPieza: updates.cantidadPorPieza ?? existing?.cantidadPorPieza ?? 1,
    }

    await db.catalogo_medicamentos.put(updated)
    await db.medicines.put(updated as any)

    const payloadForSupabase: Record<string, unknown> = {}
    if (updates.codigo_barras !== undefined) payloadForSupabase.codigo_barras = updates.codigo_barras
    if (updates.clave_ssa !== undefined) payloadForSupabase.clave_ssa = updates.clave_ssa
    if (updates.medicamento !== undefined) payloadForSupabase.medicamento = updates.medicamento
    if (updates.presentacion !== undefined) payloadForSupabase.presentacion = updates.presentacion
    if (updates.activo !== undefined) payloadForSupabase.activo = updates.activo

    await syncQueueRepository.enqueue('catalogo_medicamentos', 'update', id, payloadForSupabase)
  },

  /**
   * Cambia el estatus (Activo/Inactivo o boolean) de un medicamento.
   */
  async updateStatus(id: string, statusOrActive: boolean | string): Promise<void> {
    const isActivo = typeof statusOrActive === 'boolean' 
      ? statusOrActive 
      : statusOrActive.toLowerCase() === 'activo'
    await this.update(id, { activo: isActivo })
  },

  /**
   * Elimina un medicamento del catálogo localmente y encola la eliminación para Supabase.
   */
  async delete(id: string): Promise<void> {
    await db.catalogo_medicamentos.delete(id)
    await db.medicines.delete(id)
    await syncQueueRepository.enqueue('catalogo_medicamentos', 'delete', id, { id })
  },
}

// Exportamos también como alias para máxima compatibilidad
export const medicineRepository = catalogoMedicamentoRepository
