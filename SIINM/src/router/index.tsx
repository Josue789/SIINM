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
import { PrescriptionsPage } from '../pages/prescriptions/PrescriptionsPage'
import { SupplyEntryPage } from '../pages/supply-entry/SupplyEntryPage'
import { ExportPage } from '../pages/export/ExportPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { CatalogPage } from '../pages/catalog/CatalogPage'
import { SupervisionPage } from '../pages/supervision/SupervisionPage'
import { NotFoundPage } from '../pages/not-found/NotFoundPage'
import { ROUTES } from './routes'

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

      // Rutas Protegidas del Sistema (Figma Layout)
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                path: ROUTES.ROOT,
                element: <Navigate to={ROUTES.PRESCRIPTIONS} replace />,
              },
              {
                path: ROUTES.PRESCRIPTIONS,
                element: <PrescriptionsPage />,
              },
              {
                path: ROUTES.SUPPLY_ENTRY,
                element: <SupplyEntryPage />,
              },
              {
                path: ROUTES.INVENTORY,
                element: <InventoryPage />,
              },
              {
                path: ROUTES.EXPORT,
                element: <ExportPage />,
              },
              {
                path: ROUTES.SETTINGS,
                element: <SettingsPage />,
              },
              {
                path: ROUTES.MASTER_CATALOG,
                element: <CatalogPage />,
              },
              {
                path: ROUTES.CLINIC_SUPERVISION,
                element: <SupervisionPage />,
              },

              // Compatibilidad con vistas previas
              {
                path: ROUTES.DASHBOARD,
                element: <DashboardPage />,
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
