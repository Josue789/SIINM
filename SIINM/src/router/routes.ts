/**
 * Constantes centralizadas de rutas para navegación y redirecciones.
 */
export const ROUTES = {
  // Rutas públicas / Auth
  LOGIN: '/login',

  // Rutas protegidas
  ROOT: '/',
  DASHBOARD: '/dashboard',
  INVENTORY: '/inventory',
  SYNC: '/sync',

  // Fallback
  NOT_FOUND: '*',
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES]
