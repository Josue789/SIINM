import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Package, Calendar, Tag, AlertTriangle } from 'lucide-react'
import { medicineRepository } from '../../db/repositories/medicine.repository'
import { useNetwork } from '../../context/NetworkContext'
import type { Medicine } from '../../types/inventory.types'

export const InventoryPage: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { refreshPendingCount } = useNetwork()

  const loadMedicines = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await medicineRepository.getAll()
      setMedicines(items)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMedicines()
  }, [loadMedicines])

  // Crear un medicamento de prueba directamente en Dexie y encolar
  const handleAddSampleMedicine = async () => {
    const sampleNames = [
      { name: 'Paracetamol 500mg', code: 'MED-001', category: 'Analgésicos', form: 'Tabletas', price: 45 },
      { name: 'Amoxicilina 875mg', code: 'MED-002', category: 'Antibióticos', form: 'Cápsulas', price: 120 },
      { name: 'Ibuprofeno 400mg', code: 'MED-003', category: 'Antiinflamatorios', form: 'Comprimidos', price: 60 },
      { name: 'Omeprazol 20mg', code: 'MED-004', category: 'Antiácidos', form: 'Cápsulas', price: 85 },
      { name: 'Loratadina 10mg', code: 'MED-005', category: 'Antihistamínicos', form: 'Jarabe', price: 70 },
    ]

    const item = sampleNames[Math.floor(Math.random() * sampleNames.length)]

    await medicineRepository.create({
      code: `${item.code}-${Math.floor(Math.random() * 1000)}`,
      name: item.name,
      category: item.category,
      dosageForm: item.form,
      stock: Math.floor(Math.random() * 50) + 10,
      minStock: 10,
      price: item.price,
      batchNumber: `LOTE-${new Date().getFullYear()}`,
      expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })

    await loadMedicines()
    await refreshPendingCount()
  }

  const handleDelete = async (id: string) => {
    await medicineRepository.delete(id)
    await loadMedicines()
    await refreshPendingCount()
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Inventario de Medicamentos</h1>
          <p className="text-xs text-slate-400">
            Registro local instantáneo (IndexedDB) con sincronización transparente a Supabase.
          </p>
        </div>

        <button
          onClick={handleAddSampleMedicine}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Medicamento Demo (Offline)</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Cargando base de datos local...</div>
      ) : medicines.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No hay medicamentos aún</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            Comienza agregando un medicamento. Se guardará de inmediato en Dexie y se preparará para
            subir a Supabase en cuanto tengas conexión.
          </p>
          <button
            onClick={handleAddSampleMedicine}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Crear primer registro local</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Medicamento</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3">Estado Local</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {medicines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-emerald-400">{m.code}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      <div>{m.name}</div>
                      <span className="text-[10px] text-slate-500">{m.dosageForm}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                        <Tag className="w-3 h-3 text-slate-500" />
                        {m.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {m.stock}{' '}
                      {m.stock <= m.minStock && (
                        <span className="text-amber-400 inline-flex items-center gap-0.5 ml-1" title="Stock bajo">
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {m.expirationDate || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.isLocalOnly ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pendiente de Sync
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Sincronizado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-rose-400 hover:text-rose-300 font-medium text-xs px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
