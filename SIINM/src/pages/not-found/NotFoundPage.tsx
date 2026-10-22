import React from 'react'
import { Link } from 'react-router-dom'
import { FileQuestion, Home } from 'lucide-react'
import { ROUTES } from '../../router/routes'
import { Button } from '@/components/ui/button'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col items-center justify-center p-6 text-center text-slate-800">
      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center mb-4 text-blue-600 shadow-xs">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-black text-slate-800 mb-2">404</h1>
      <h2 className="text-lg font-bold text-slate-700 mb-2">Página no encontrada</h2>
      <p className="text-xs text-slate-500 max-w-sm mb-6">
        La ruta a la que intentas acceder no existe en el sistema o fue movida.
      </p>
      <Button asChild className="gap-2">
        <Link to={ROUTES.PRESCRIPTIONS}>
          <Home className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </Link>
      </Button>
    </div>
  )
}
