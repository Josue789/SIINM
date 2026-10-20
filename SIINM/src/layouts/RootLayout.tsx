import React from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { NetworkProvider } from '../context/NetworkContext'

/**
 * RootLayout envuelve a toda la aplicación con los contextos globales
 * de Autenticación y Estado de Red/Sincronización.
 */
export const RootLayout: React.FC = () => {
  return (
    <AuthProvider>
      <NetworkProvider>
        <Outlet />
      </NetworkProvider>
    </AuthProvider>
  )
}
