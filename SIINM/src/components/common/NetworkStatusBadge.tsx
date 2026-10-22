import React from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useNetwork } from '../../context/NetworkContext'

export const NetworkStatusBadge: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useNetwork()

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
        <span>Sincronizando...</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
        <WifiOff className="w-3.5 h-3.5 text-rose-600" />
        <span>Offline ({pendingCount} pendientes)</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => triggerSync()}
      title="Haz clic para sincronizar ahora"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
    >
      <Wifi className="w-3.5 h-3.5 text-emerald-600" />
      <span>En línea {pendingCount > 0 ? `(${pendingCount} en cola)` : '✓'}</span>
    </button>
  )
}
