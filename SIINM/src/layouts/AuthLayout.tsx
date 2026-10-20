import React from 'react'
import { Outlet } from 'react-router-dom'
import { Pill } from 'lucide-react'

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
            <Pill className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white m-0">SIINM</h1>
            <p className="text-xs text-slate-400">Sistema de Inventario de Medicamentos</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
