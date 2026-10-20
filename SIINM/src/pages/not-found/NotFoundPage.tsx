import React from 'react'
import { Link } from 'react-router-dom'
import { FileQuestion, Home } from 'lucide-react'
import { ROUTES } from '../../router/routes'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-emerald-400">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-white mb-2">404</h1>
      <h2 className="text-lg font-semibold text-slate-300 mb-2">Página no encontrada</h2>
      <p className="text-xs text-slate-500 max-w-sm mb-6">
        La ruta a la que intentas acceder no existe en el sistema de inventario o fue movida.
      </p>
      <Link
        to={ROUTES.DASHBOARD}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-colors shadow-lg shadow-emerald-500/20"
      >
        <Home className="w-4 h-4" />
        <span>Volver al Inicio</span>
      </Link>
    </div>
  )
}
