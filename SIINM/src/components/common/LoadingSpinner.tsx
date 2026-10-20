import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  message?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Cargando aplicación...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-6">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
        <Loader2 className="w-8 h-8 text-emerald-400 absolute animate-pulse" />
      </div>
      <p className="text-slate-300 font-medium text-sm tracking-wide">{message}</p>
      <span className="text-slate-500 text-xs mt-2">Inicializando datos locales Offline-First</span>
    </div>
  )
}
