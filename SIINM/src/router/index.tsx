import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '../layouts/RootLayout'
import { MainLayout } from '../layouts/MainLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { PublicRoute } from './guards/PublicRoute'
import { LoginPage } from '../pages/auth/LoginPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { InventoryPage } from '../pages/inventory/InventoryPage'
import { SyncPage } from '../pages/sync/SyncPage'
import { NotFoundPage } from '../pages/not-found/NotFoundPage'
import { ROUTES } from './routes'

/**
 * Árbol de enrutamiento principal de SIINM:
 *
 * 1. RootLayout: Provee AuthContext y NetworkContext a nivel global.
 * 2. PublicRoute (/login): Redirige al Dashboard si ya existe sesión (offline o live).
 * 3. ProtectedRoute (/dashboard, /inventory, /sync): Redirige a /login si no hay sesión autenticada.
 * 4. Redirección raíz (/ -> /dashboard).
 * 5. Catch-all (*): Redirige o muestra pantalla 404 amigable.
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Rutas Públicas de Invitado
      {
        element: <PublicRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                path: ROUTES.LOGIN,
                element: <LoginPage />,
              },
            ],
          },
        ],
      },

      // Rutas Protegidas del Sistema
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                path: ROUTES.ROOT,
                element: <Navigate to={ROUTES.DASHBOARD} replace />,
              },
              {
                path: ROUTES.DASHBOARD,
                element: <DashboardPage />,
              },
              {
                path: ROUTES.INVENTORY,
                element: <InventoryPage />,
              },
              {
                path: ROUTES.SYNC,
                element: <SyncPage />,
              },
            ],
          },
        ],
      },

      // Ruta de No Encontrado
      {
        path: ROUTES.NOT_FOUND,
        element: <NotFoundPage />,
      },
    ],
  },
])
