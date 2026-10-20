export interface Medicine {
  id: string
  code: string
  name: string
  genericName?: string
  category: string
  dosageForm: string // Ej: tabletas, jarabe, ampollas
  stock: number
  minStock: number
  batchNumber?: string
  expirationDate?: string
  price: number
  location?: string
  createdAt: string
  updatedAt: string
  isLocalOnly?: boolean // Para identificar si aún no se ha subido a Supabase
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
