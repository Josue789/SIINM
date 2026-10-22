import React, { useState } from 'react'
import { Barcode, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const PrescriptionsPage: React.FC = () => {
  const [recipeFolio, setRecipeFolio] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')

  // Medicamentos agregados de demostración según Figma Desktop - 1
  const [addedItems, setAddedItems] = useState([
    {
      id: '1',
      name: 'PENICILINA 100 MG (Tab C/20)',
      ssa: '010.000.0410.00',
      stock: 20,
      lote: 'AH224',
      caducidad: 'Oct/26',
      quantity: 1,
    },
    {
      id: '2',
      name: 'CLORANFENICOL 400 MG (C/50)',
      ssa: '010.000.0410.02',
      stock: 5,
      lote: 'AH224',
      caducidad: 'Oct/26',
      quantity: 1,
    },
  ])

  const handleRemoveItem = (id: string) => {
    setAddedItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateQuantity = (id: string, delta: number) => {
    setAddedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta)
          return { ...item, quantity: newQty }
        }
        return item
      })
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Título de la pantalla */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Surtimiento de Recetas
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Escanea el código de barras o ingresa el folio para surtir medicamentos
        </p>
      </div>

      {/* Formulario superior: Folio y Lectura de Código de barras */}
      <Card className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Folio de Receta
          </label>
          <Input
            type="text"
            value={recipeFolio}
            onChange={(e) => setRecipeFolio(e.target.value)}
            placeholder="Ingrese el número de folio de la receta"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Lectura de Insumo / Código de Barras
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Escanee o escriba el código del medicamento..."
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0"
              title="Escanear código de barras"
            >
              <Barcode className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Sección Insumos Agregados */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Insumos Agregados
        </h2>

        {addedItems.length === 0 ? (
          <Card className="p-8 text-center text-slate-400 text-xs">
            No hay insumos en la lista aún. Escanea un código para agregar.
          </Card>
        ) : (
          <div className="space-y-3">
            {addedItems.map((item) => (
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
                      STOCK: <strong className="text-slate-700">{item.stock} piezas</strong>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-amber-800 font-medium flex items-center gap-2">
                    <span>LOTE Y CADUCIDAD:</span>
                    <Badge variant="outline" className="font-mono text-xs bg-white text-slate-700">
                      {item.lote}
                    </Badge>
                    <span>Cad: {item.caducidad}</span>
                  </div>
                </div>

                {/* Contador de cantidad y botón eliminar */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-xs font-bold text-slate-800 min-w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveItem(item.id)}
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

      {/* Barra de Acciones Final según Figma Desktop - 1 */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <div className="text-xs text-slate-500 font-medium">
          Total de insumos a surtir: <strong className="text-slate-800">{addedItems.reduce((acc, i) => acc + i.quantity, 0)} unidades</strong>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setAddedItems([])}
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
            <span>+ Surtir receta</span>
          </Button>
        </div>
      </Card>
    </div>
  )
}
