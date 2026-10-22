import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn, Key, Mail, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '../../context/AuthContext'
import { ROUTES } from '../../router/routes'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('farmacia@siinm.local')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Ruta a la que intentaba acceder antes de ser redirigido
  const destination = (location.state as { from?: { pathname: string } })?.from?.pathname || ROUTES.PRESCRIPTIONS

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await login(email, password)

    if (result.success) {
      // Redirige al destino previo o a la ruta por defecto
      navigate(destination, { replace: true })
    } else {
      setError(result.error || 'Error de autenticación')
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Iniciar Sesión</h2>
        <p className="text-xs text-slate-500">
          Accede al panel de control de medicamentos e insumos
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Correo Electrónico
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-9"
              placeholder="ejemplo@siinm.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-9"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 h-11"
        >
          {isSubmitting ? (
            <span>Iniciando...</span>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Entrar al Sistema</span>
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-200/80 text-center">
        <p className="text-[11px] text-slate-500 mb-2">
          💡 Modo Offline: puedes iniciar sesión con las credenciales demo incluso sin internet.
        </p>
        <button
          type="button"
          onClick={() => {
            setEmail('demo@siinm.local')
            setPassword('demo123')
          }}
          className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 font-semibold cursor-pointer"
        >
          <span>Usar credenciales de prueba</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
