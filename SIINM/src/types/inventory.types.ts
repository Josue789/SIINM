// Entidades reales de la Base de Datos (Supabase)
export interface CatalogoMedicamento {
  id: string
  codigo_barras: string
  clave_ssa: string
  medicamento: string
  presentacion: string
  activo: boolean
  // Campos auxiliares para la interfaz y compatibilidad
  name?: string
  ssa?: string
  estatus?: string
  cantidadPorPieza?: number
  isLocalOnly?: boolean
}

export interface InventarioItem {
  id: number | string
  update_date: string
  id_clinica: number
  id_medicamento: number
  lote: string
  stock: number
  fecha_caducidad: string
}

export interface Clinica {
  id: number
  created_at: string
  nombre: string
  ubicacion?: string
  telefono?: string
  clues?: string
  activo: boolean
}

export type TipoMovimiento = 'Entrada' | 'Salida' | 'Ajuste' | 'Receta'

export interface BitacoraMovement {
  id: number | string
  created_at: string
  id_clinica: number
  id_inventario: number
  tipo_movimiento: TipoMovimiento
  folio_receta?: string
  cantidad: number
  fecha_hora: string
}

// Tipo adaptado para compatibilidad con vistas actuales
export interface Medicine {
  id: string
  code: string
  name: string
  genericName?: string
  category: string
  dosageForm: string
  stock: number
  minStock: number
  batchNumber?: string
  expirationDate?: string
  price: number
  location?: string
  createdAt: string
  updatedAt: string
  isLocalOnly?: boolean
  // Columnas directas de catalogo_medicamentos
  codigo_barras?: string
  clave_ssa?: string
  medicamento?: string
  presentacion?: string
  activo?: boolean
}

export interface InventoryMovement {
  id: string
  medicineId: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  reason: string
  userId?: string
  createdAt: string
}
