import React, { useState } from 'react'
import { Plus, Search, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const CatalogPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSsa, setNewSsa] = useState('')
  const [newMedicine, setNewMedicine] = useState('')
  const [newPresentation, setNewPresentation] = useState('')
  const [newQuantity, setNewQuantity] = useState('1')

  const [catalogItems, setCatalogItems] = useState([
    {
      id: '1',
      ssa: '00100',
      medicamento: 'paracetamol',
      presentacion: '25 mg',
      cantidadPorPieza: 5,
      estatus: 'Activo',
    },
    {
      id: '2',
      ssa: '00101',
      medicamento: 'amoxicilina',
      presentacion: '500 mg',
      cantidadPorPieza: 20,
      estatus: 'Activo',
    },
    {
      id: '3',
      ssa: '010.000.0410.00',
      medicamento: 'penicilina g',
      presentacion: '100 mg (Tab C/20)',
      cantidadPorPieza: 20,
      estatus: 'Activo',
    },
  ])

  const handleAddMedicine = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMedicine.trim()) return

    setCatalogItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        ssa: newSsa.trim() || '00000',
        medicamento: newMedicine.trim(),
        presentacion: newPresentation.trim() || 'Pieza',
        cantidadPorPieza: parseInt(newQuantity) || 1,
        estatus: 'Activo',
      },
    ])

    setNewSsa('')
    setNewMedicine('')
    setNewPresentation('')
    setNewQuantity('1')
    setIsDialogOpen(false)
  }

  const filteredItems = catalogItems.filter((item) => {
    const matchesSearch =
      item.medicamento.toLowerCase().includes(search.toLowerCase()) ||
      item.ssa.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
            Catálogo Maestro
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Catálogo institucional de medicamentos, cuadros básicos y especificaciones
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 self-start sm:self-auto gap-2">
              <Plus className="w-4 h-4" />
              <span>Añadir medicamento</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddMedicine} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Medicamento</DialogTitle>
                <DialogDescription>
                  Ingresa los detalles técnicos del medicamento para darlo de alta en el catálogo maestro.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Clave SSA
                  </label>
                  <Input
                    placeholder="Ej. 010.000.0410.00"
                    value={newSsa}
                    onChange={(e) => setNewSsa(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nombre del Medicamento
                  </label>
                  <Input
                    placeholder="Ej. Paracetamol 500mg"
                    value={newMedicine}
                    onChange={(e) => setNewMedicine(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Presentación
                    </label>
                    <Input
                      placeholder="Ej. Caja c/20 tabletas"
                      value={newPresentation}
                      onChange={(e) => setNewPresentation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Cantidad / Pieza
                    </label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Guardar Medicamento
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
            Filtrar Medicamentos:
          </span>
          <Button
            size="sm"
            variant={filter === 'todos' ? 'default' : 'secondary'}
            onClick={() => setFilter('todos')}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filter === 'cuadro_basico' ? 'default' : 'secondary'}
            onClick={() => setFilter('cuadro_basico')}
          >
            Cuadro básico
          </Button>
        </div>

        <div className="relative w-full md:w-72">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar medicamento..."
            className="pr-9 h-9 text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </Card>

      <Card className="overflow-hidden p-0 border border-slate-200/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SSA</TableHead>
              <TableHead>Medicamento</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead>Cantidad por pieza</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium text-slate-700">{item.ssa}</TableCell>
                <TableCell className="font-semibold text-slate-800">{item.medicamento}</TableCell>
                <TableCell className="text-slate-600">{item.presentacion}</TableCell>
                <TableCell className="text-slate-800 font-medium">{item.cantidadPorPieza}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    {item.estatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      
    </div>
  )
}
