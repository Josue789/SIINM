import React, { useState, useEffect } from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  ChevronRight,
  LoaderCircle,
  Building2,
  Package,
  Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useNetwork } from '@/context/NetworkContext'
import { inventarioRepository } from '@/db/repositories/inventario.repository'
import { clinicaRepository } from '@/db/repositories/clinica.repository'
import type { Clinica } from '@/types/inventory.types'
import {
  getInventoryExportData,
  exportToExcel,
  exportToPdf,
  exportToCsv,
  type ExportInventoryItem,
} from '@/services/export/exportService'
import { toast } from 'react-toastify'

export const ExportPage: React.FC = () => {
  const { user } = useAuth()
  const { isOnline, triggerSync } = useNetwork()

  const [syncWithServer, setSyncWithServer] = useState(true)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const [clinics, setClinics] = useState<Clinica[]>([])
  const [selectedClinicId, setSelectedClinicId] = useState<number>(() => {
    return user?.clinicaId ? Number(user.clinicaId) : 0
  })
  const [previewItems, setPreviewItems] = useState<ExportInventoryItem[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Cargar lista de clínicas para administradores
  useEffect(() => {
    let isMounted = true
    const loadClinics = async () => {
      try {
        const data = await clinicaRepository.getAll({ onlyActive: true })
        if (isMounted) {
          setClinics(data)
        }
      } catch (err) {
        console.warn('No se pudieron obtener las clínicas de Supabase:', err)
      }
    }

    if (user?.role === 'admin') {
      loadClinics()
    }
  }, [user?.role])

  // Cargar resumen de items que serán exportados
  useEffect(() => {
    let isMounted = true
    const loadPreview = async () => {
      setIsLoadingPreview(true)
      try {
        const filterClinic = selectedClinicId > 0 ? selectedClinicId : (user?.clinicaId ? Number(user.clinicaId) : null)
        const items = await getInventoryExportData(filterClinic)
        if (isMounted) {
          setPreviewItems(items)
        }
      } catch (err) {
        console.error('Error cargando preview de inventario:', err)
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false)
        }
      }
    }

    loadPreview()
  }, [selectedClinicId, user?.clinicaId])

  // Determinar el nombre de la clínica a imprimir en los reportes
  const activeClinicName = (() => {
    if (selectedClinicId > 0) {
      const found = clinics.find((c) => c.id === selectedClinicId)
      if (found) return found.nombre
    }
    if (user?.clinicaNombre) return user.clinicaNombre
    if (user?.clinicaId && clinics.length > 0) {
      const found = clinics.find((c) => c.id === Number(user.clinicaId))
      if (found) return found.nombre
    }
    return 'Todas las Clínicas'
  })()

  const totalStockCount = previewItems.reduce((acc, curr) => acc + (curr.stock || 0), 0)

  const exportOptions = [
    {
      id: 'pdf',
      title: 'Descarga inventario en formato PDF',
      format: 'Documento PDF (.pdf)',
      description: 'Reporte oficial estructurado y paginado en orientación horizontal con sellos de fecha.',
      icon: FileText,
      color: 'text-red-600 bg-red-50 group-hover:bg-red-100',
    },
    {
      id: 'excel',
      title: 'Descarga inventario en formato Excel',
      format: 'Libro de Excel (.xlsx)',
      description: 'Hoja de cálculo estilizada con autofiltros, semáforo de caducidades y fórmulas de totales.',
      icon: FileSpreadsheet,
      color: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100',
    },
    {
      id: 'csv',
      title: 'Descarga inventario en formato CSV',
      format: 'Valores separados por comas (.csv)',
      description: 'Compatible universalmente con Excel y bases de datos con soporte de acentos UTF-8.',
      icon: FileCode,
      color: 'text-blue-600 bg-blue-50 group-hover:bg-blue-100',
    },
  ]

  const handleExport = async (formatId: string) => {
    if (exportingFormat) return
    setExportingFormat(formatId)

    try {
      // 1. Sincronizar si está activado
      if (syncWithServer) {
        if (isOnline) {
          try {
            await inventarioRepository.pushUnsyncedLocal()
            const clinicToSync = selectedClinicId > 0 ? selectedClinicId : (user?.clinicaId ? Number(user.clinicaId) : undefined)
            await inventarioRepository.pullFromRemote(clinicToSync)
            await triggerSync(true)
          } catch (syncErr) {
            console.warn('Aviso durante sincronización antes de exportar:', syncErr)
          }
        } else {
          toast.info('Sin conexión a Internet: exportando con los datos locales guardados.')
        }
      }

      // 2. Obtener datos actualizados del inventario
      const filterClinic = selectedClinicId > 0 ? selectedClinicId : (user?.clinicaId ? Number(user.clinicaId) : null)
      const items = await getInventoryExportData(filterClinic)

      if (items.length === 0) {
        toast.warn('No hay registros de inventario disponibles para exportar en este momento.')
        setExportingFormat(null)
        return
      }

      // 3. Opciones comunes para el reporte
      const options = {
        clinicName: activeClinicName,
        userName: user?.fullName || user?.email || 'Personal de Farmacia',
        generatedAt: new Date(),
      }

      // 4. Generar según el formato seleccionado
      if (formatId === 'excel') {
        await exportToExcel(items, options)
        toast.success('Reporte en formato Excel (.xlsx) generado y descargado.')
      } else if (formatId === 'pdf') {
        await exportToPdf(items, options)
        toast.success('Reporte en formato PDF (.pdf) generado y descargado.')
      } else if (formatId === 'csv') {
        await exportToCsv(items, options)
        toast.success('Reporte en formato CSV (.csv) generado y descargado.')
      }
    } catch (err) {
      console.error('Error generando exportación:', err)
      const message = err instanceof Error ? err.message : 'Error al generar el reporte'
      toast.error(`No se pudo generar la exportación: ${message}`)
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Título de la página */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Exportar Inventario
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Descarga los datos del inventario actual en una de las diferentes opciones para compartir
        </p>
      </div>

      {/* Switch sincronización con servidor */}
      <Card className="p-4 flex items-center justify-between shadow-xs border-slate-200">
        <div>
          <p className="text-xs font-bold text-slate-700 m-0">Sincronizar con servidor antes de exportar</p>
          <p className="text-[11px] text-slate-400 m-0">
            {syncWithServer
              ? 'Asegura tener los datos más actualizados de la nube antes de generar el archivo'
              : 'Se exportarán inmediatamente los datos locales sin consultar la red'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSyncWithServer(!syncWithServer)}
          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
            syncWithServer ? 'bg-blue-600' : 'bg-slate-300'
          }`}
          aria-label="Alternar sincronización antes de exportar"
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              syncWithServer ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </Card>

      {/* Panel de Resumen de Inventario a exportar */}
      <Card className="p-4 bg-slate-50/70 border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100/70 text-blue-700">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Unidad a exportar
              </span>
              {user?.role === 'admin' && clinics.length > 0 ? (
                <div className="mt-0.5">
                  <select
                    value={selectedClinicId}
                    onChange={(e) => setSelectedClinicId(Number(e.target.value))}
                    className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value={0}>Todas las Clínicas (Consolidado)</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-800 m-0">{activeClinicName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 sm:border-l sm:border-slate-200 sm:pl-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] font-medium text-slate-400 block leading-tight">
                  Insumos
                </span>
                <span className="text-xs font-black text-slate-700">
                  {isLoadingPreview ? '...' : previewItems.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] font-medium text-slate-400 block leading-tight">
                  Piezas totales
                </span>
                <span className="text-xs font-black text-slate-700">
                  {isLoadingPreview ? '...' : totalStockCount.toLocaleString('en-US')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Opciones de Descarga según Figma Desktop - 4 */}
      <div className="space-y-3">
        {exportOptions.map((opt) => {
          const Icon = opt.icon
          const isCurrentlyExporting = exportingFormat === opt.id

          return (
            <Card
              key={opt.id}
              onClick={() => handleExport(opt.id)}
              className={`p-4 transition-all group text-left border-slate-200 shadow-xs ${
                exportingFormat && !isCurrentlyExporting
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:bg-slate-50/80 hover:border-slate-300 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl transition-colors ${opt.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 m-0 group-hover:text-blue-600 transition-colors">
                      {opt.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 m-0">{opt.format}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isCurrentlyExporting ? (
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold">Generando...</span>
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
