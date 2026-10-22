import React, { useState } from 'react'
import { Search, Building2, MoreVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const SupervisionPage: React.FC = () => {
  const [selectedClinic, setSelectedClinic] = useState('Clínica Central Norte')
  const [search, setSearch] = useState('')

  const clinicsData = [
    {
      id: '1',
      ssa: '00100',
      medicamento: 'paracetamol',
      lote: '00000',
      caducidad: 'Oct/26',
      stock: 5,
    },
    {
      id: '2',
      ssa: '00102',
      medicamento: 'ibuprofeno 400mg',
      lote: 'B5541',
      caducidad: 'Nov/26',
      stock: 18,
    },
  ]

  const filteredData = clinicsData.filter(
    (item) =>
      item.medicamento.toLowerCase().includes(search.toLowerCase()) ||
      item.ssa.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Supervisión de Clínicas
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitoreo consolidado de inventarios por unidad y clínica médica
        </p>
      </div>

      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Filtrar Medicamentos:
          </span>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClinic}
              onChange={(e) => setSelectedClinic(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="Clínica Central Norte">Clínica Central Norte</option>
              <option value="Unidad Médica Sur">Unidad Médica Sur</option>
              <option value="Módulo Rural Poniente">Módulo Rural Poniente</option>
            </select>
          </div>
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
              <TableHead>Lote</TableHead>
              <TableHead>Fech. caducidad</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium text-slate-700">{item.ssa}</TableCell>
                <TableCell className="font-semibold text-slate-800">{item.medicamento}</TableCell>
                <TableCell className="font-mono text-slate-600">{item.lote}</TableCell>
                <TableCell className="font-bold text-red-500">{item.caducidad}</TableCell>
                <TableCell className="font-bold text-slate-800">{item.stock}</TableCell>
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

