import React, { useState } from 'react'
import { FileText, FileSpreadsheet, FileCode, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

export const ExportPage: React.FC = () => {
  const [syncWithServer, setSyncWithServer] = useState(true)

  const exportOptions = [
    {
      id: 'pdf',
      title: 'Descarga inventario en formato PDF',
      format: 'PDF Document',
      icon: FileText,
      color: 'text-red-600 bg-red-50',
    },
    {
      id: 'excel',
      title: 'Descarga inventario en formato Excel',
      format: '.xlsx Spreadsheet',
      icon: FileSpreadsheet,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      id: 'csv',
      title: 'Descarga inventario en formato CSV',
      format: 'Comma Separated Values',
      icon: FileCode,
      color: 'text-blue-600 bg-blue-50',
    },
  ]

  const handleExport = (formatId: string) => {
    alert(`Generando reporte en formato ${formatId.toUpperCase()}...`)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Exportar Inventario
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Descarga los datos del inventario actual en una de las diferentes opciones para compartir
        </p>
      </div>

      {/* Switch sincronización con servidor */}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-700 m-0">Sincronizar con servidor antes de exportar</p>
          <p className="text-[11px] text-slate-400 m-0">Asegura tener los datos más actualizados de la nube</p>
        </div>
        <button
          type="button"
          onClick={() => setSyncWithServer(!syncWithServer)}
          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
            syncWithServer ? 'bg-blue-600' : 'bg-slate-300'
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              syncWithServer ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </Card>

      {/* Lista de Opciones de Descarga según Figma Desktop - 4 */}
      <div className="space-y-3">
        {exportOptions.map((opt) => {
          const Icon = opt.icon
          return (
            <Card
              key={opt.id}
              onClick={() => handleExport(opt.id)}
              className="p-4 hover:bg-slate-50/80 flex items-center justify-between transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl ${opt.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 m-0 group-hover:text-blue-600 transition-colors">
                    {opt.title}
                  </h3>
                  <span className="text-[11px] text-slate-400">{opt.format}</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </Card>
          )
        })}
      </div>
    </div>
  )
}
