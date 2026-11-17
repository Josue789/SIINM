import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROUTES } from '../routes'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

/**
 * Guard para rutas exclusivas de invitados (como Login).
 * Si el usuario ya está autenticado, lo redirige al Dashboard
 * o a la página que intentaba visitar previamente.
 */
export const PublicRoute: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner message="Comprobando credenciales..." />
  }

  if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
    return (
      <Navigate
        to={`${ROUTES.RESET_PASSWORD}${window.location.search}${window.location.hash}`}
        replace
      />
    )
  }

  if (isAuthenticated && user?.mustChangePassword) {
    return (
      <Navigate
        to={`${ROUTES.RESET_PASSWORD}?email=${encodeURIComponent(user.email || '')}`}
        replace
      />
    )
  }

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || ROUTES.DASHBOARD
    return <Navigate to={from} replace />
  }

  return <Outlet />
}
