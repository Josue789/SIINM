import React, { useState } from 'react'
import { Plus, Check, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const SupplyEntryPage: React.FC = () => {
  const [barcode, setBarcode] = useState('')
  const [warehouse, setWarehouse] = useState('Almacén Central')
  const [medicineName, setMedicineName] = useState('')
  const [ssa, setSsa] = useState('')
  const [quantityPerPiece, setQuantityPerPiece] = useState('1')
  const [expiryDate, setExpiryDate] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [location, setLocation] = useState('')

  const [incomingItems, setIncomingItems] = useState([
    {
      id: '1',
      name: 'PENICILINA 100 MG (Tab C/20)',
      ssa: '010.000.0410.00',
      lote: 'AH224',
      caducidad: 'Oct/26',
      quantity: 50,
    },
  ])

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!medicineName.trim()) return

    setIncomingItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: medicineName,
        ssa: ssa || '000.000.0000.00',
        lote: lotNumber || 'LOT-NUEVO',
        caducidad: expiryDate || 'N/A',
        quantity: parseInt(quantityPerPiece) || 1,
      },
    ])

    // Reset inputs
    setMedicineName('')
    setSsa('')
    setQuantityPerPiece('1')
    setExpiryDate('')
    setLotNumber('')
    setLocation('')
  }

  const handleRemove = (id: string) => {
    setIncomingItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Entrada de Insumos
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Registra el ingreso de medicamentos y suministros al almacén
        </p>
      </div>

      {/* Formulario de Captura según Figma Desktop - 2 */}
      <Card className="p-5">
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Código de Barras
              </label>
              <Input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Escanee código de barras..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Almacén
              </label>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 h-10 text-xs md:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors shadow-2xs"
              >
                <option value="Almacén Central">Almacén Central</option>
                <option value="Farmacia Consultorio 1">Farmacia Consultorio 1</option>
                <option value="Urgencias">Urgencias</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre del Medicamento
              </label>
              <Input
                type="text"
                required
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                placeholder="Ej. Paracetamol 500mg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                SSA
              </label>
              <Input
                type="text"
                value={ssa}
                onChange={(e) => setSsa(e.target.value)}
                placeholder="010.000.0000.00"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cantidad por Pieza
              </label>
              <Input
                type="number"
                min="1"
                value={quantityPerPiece}
                onChange={(e) => setQuantityPerPiece(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Fecha de Caducidad
              </label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Número de Lote
              </label>
              <Input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Ej. AH224"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Habitación / Ubicación
              </label>
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Estante A-3"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-10"
            >
              <Plus className="w-4 h-4" />
              <span>AÑADIR A LISTA</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Sección Insumos Entrantes */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Insumos Entrantes
        </h2>

        {incomingItems.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 text-xs shadow-xs">
            No hay insumos pendientes de ingresar. Llena el formulario superior.
          </div>
        ) : (
          <div className="space-y-3">
            {incomingItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#fffdf5] border border-amber-200/70 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-800 m-0">{item.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>
                      SSA: <strong className="text-slate-700 font-mono">{item.ssa}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      CANTIDAD: <strong className="text-slate-700">{item.quantity} piezas</strong>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-amber-800 font-medium">
                    LOTE Y CADUCIDAD: <span className="font-mono">{item.lote}</span> | Cad: {item.caducidad}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <Badge variant="outline" className="px-3 py-1 text-xs font-bold text-slate-800">
                    {item.quantity} unidades
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemove(item.id)}
                    title="Eliminar insumo"
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra de Acciones Final */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <div className="text-xs text-slate-500 font-medium">
          Total por ingresar: <strong className="text-slate-800">{incomingItems.reduce((acc, i) => acc + i.quantity, 0)} piezas</strong>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setIncomingItems([])}
            className="flex-1 sm:flex-none gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>X Cancelar</span>
          </Button>

          <Button
            type="button"
            className="flex-1 sm:flex-none gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>+ Ingresar medicamentos</span>
          </Button>
        </div>
      </Card>
    </div>
  )
}
