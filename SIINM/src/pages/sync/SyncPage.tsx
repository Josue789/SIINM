import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle2, Clock, CloudUpload, HardDrive, Wifi, WifiOff } from 'lucide-react'
import { syncQueueRepository } from '../../db/repositories/syncQueue.repository'
import { useNetwork } from '../../context/NetworkContext'
import type { SyncQueueItem } from '../../types/sync.types'

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
          <h1 className="text-2xl font-bold text-white mb-1">Estado de Sincronización</h1>
          <p className="text-xs text-slate-400">
            Monitorea la cola de cambios locales pendientes de sincronizar con Supabase.
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={!isOnline || isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}</span>
        </button>
      </div>

      {/* Connectivity cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Red</div>
            <div className="text-sm font-bold text-white">
              {isOnline ? 'Conectado a Internet' : 'Sin Conexión (Offline)'}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">IndexedDB (Dexie)</div>
            <div className="text-sm font-bold text-white">Activa y saludable</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <CloudUpload className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Última Sincronización</div>
            <div className="text-sm font-bold text-white">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Nunca'}
            </div>
          </div>
        </div>
      </div>

      {/* Outbox Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white m-0">
            Cola de Mutaciones Locales (Outbox Queue)
          </h2>
          <span className="text-xs text-slate-400">
            {queueItems.length} cambio(s) pendiente(s)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Examinando cola local...</div>
        ) : queueItems.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h4 className="text-sm font-semibold text-white mb-1">¡Todo está sincronizado!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No hay cambios pendientes en tu almacenamiento local. Todos los registros coinciden con
              Supabase.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Tabla</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">ID Registro</th>
                  <th className="px-4 py-3">Intentos</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {queueItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-white">{item.tableName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.action === 'insert'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : item.action === 'update'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 truncate max-w-[150px]">
                      {item.recordId}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-300">{item.attempts}</td>
                    <td className="px-4 py-3 text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
