import React from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useNetwork } from '../../context/NetworkContext'

export const NetworkStatusBadge: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useNetwork()

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Sincronizando con Supabase...</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Modo Offline ({pendingCount} cambios pendientes)</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => triggerSync()}
      title="Haz clic para sincronizar ahora"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
    >
      <Wifi className="w-3.5 h-3.5" />
      <span>En línea {pendingCount > 0 ? `(${pendingCount} en cola)` : '✓'}</span>
    </button>
  )
}
