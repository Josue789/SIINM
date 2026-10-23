import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn, Key, Mail, AlertCircle, UserPlus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '../../context/AuthContext'
import { ROUTES } from '../../router/routes'

export const LoginPage: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Ruta a la que intentaba acceder antes de ser redirigido
  const destination =
    (location.state as { from?: { pathname: string } })?.from?.pathname || ROUTES.MASTER_CATALOG

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    if (isRegisterMode) {
      const result = await register(email, password, fullName)
      setIsSubmitting(false)

      if (result.success) {
        if (result.needsEmailConfirmation) {
          setSuccessMessage(
            'Cuenta creada con éxito. Por favor, revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.'
          )
          setIsRegisterMode(false)
        } else {
          // Sesión activa inmediata
          navigate(destination, { replace: true })
        }
      } else {
        setError(result.error || 'No se pudo crear la cuenta en Supabase')
      }
    } else {
      const result = await login(email, password)
      setIsSubmitting(false)

      if (result.success) {
        navigate(destination, { replace: true })
      } else {
        setError(result.error || 'Credenciales incorrectas')
      }
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          {isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h2>
        <p className="text-xs text-slate-500">
          {isRegisterMode
            ? 'Regístrate directamente en Supabase para acceder al sistema'
            : 'Ingresa con tus credenciales de Supabase'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegisterMode && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nombre Completo
            </label>
            <Input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Pérez"
              required
            />
          </div>
        )}

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
              placeholder="usuario@ejemplo.com"
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
              minLength={6}
              className="pl-9"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full mt-2 h-11">
          {isSubmitting ? (
            <span>Conectando con Supabase...</span>
          ) : isRegisterMode ? (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              <span>Registrar Usuario</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4 mr-2" />
              <span>Entrar al Sistema</span>
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-200/80 text-center">
        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(!isRegisterMode)
            setError(null)
            setSuccessMessage(null)
          }}
          className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer transition-colors"
        >
          {isRegisterMode
            ? '¿Ya tienes cuenta? Inicia sesión aquí'
            : '¿No tienes cuenta en Supabase? Regístrate aquí'}
        </button>
      </div>
    </div>
  )
}
