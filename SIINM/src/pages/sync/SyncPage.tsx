import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle2, Clock, CloudUpload, HardDrive, Wifi, WifiOff } from 'lucide-react'
import { syncQueueRepository } from '../../db/repositories/syncQueue.repository'
import { useNetwork } from '../../context/NetworkContext'
import type { SyncQueueItem } from '../../types/sync.types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const SyncPage: React.FC = () => {
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { isOnline, isSyncing, triggerSync, lastSyncAt } = useNetwork()

  const loadQueue = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await syncQueueRepository.getPending()
      setQueueItems(items)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueue()
  }, [loadQueue, isSyncing])

  const handleManualSync = async () => {
    await triggerSync()
    await loadQueue()
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
            Estado de Sincronización
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitorea la cola de cambios locales pendientes de sincronizar con Supabase
          </p>
        </div>

        <Button
          onClick={handleManualSync}
          disabled={!isOnline || isSyncing}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}</span>
        </Button>
      </div>

      {/* Connectivity cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Red</div>
            <div className="text-sm font-bold text-slate-800">
              {isOnline ? 'Conectado a Internet' : 'Sin Conexión (Offline)'}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IndexedDB (Dexie)</div>
            <div className="text-sm font-bold text-slate-800">Activa y saludable</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <CloudUpload className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Última Sincronización</div>
            <div className="text-sm font-bold text-slate-800">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Nunca'}
            </div>
          </div>
        </Card>
      </div>

      {/* Outbox Table */}
      <Card className="overflow-hidden p-0 border border-slate-200/80">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 m-0">
            Cola de Mutaciones Locales (Outbox Queue)
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {queueItems.length} cambio(s) pendiente(s)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Examinando cola local...</div>
        ) : queueItems.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <h4 className="text-sm font-bold text-slate-800 mb-1">¡Todo está sincronizado!</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No hay cambios pendientes en tu almacenamiento local. Todos los registros coinciden con la nube.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabla</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>ID Registro</TableHead>
                <TableHead>Intentos</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium text-slate-800">{item.tableName}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.action === 'insert'
                          ? 'success'
                          : item.action === 'update'
                          ? 'default'
                          : 'destructive'
                      }
                      className="uppercase text-[10px]"
                    >
                      {item.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-slate-500 truncate max-w-[150px]">
                    {item.recordId}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-700">{item.attempts}</TableCell>
                  <TableCell className="text-slate-500">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="warning" className="text-[10px]">
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
