/**
 * Constantes centralizadas de rutas para navegación y redirecciones.
 */
export const ROUTES = {
  // Rutas públicas / Auth
  LOGIN: '/login',

  // Rutas protegidas (Figma)
  ROOT: '/',
  PRESCRIPTIONS: '/surtimiento-recetas',
  SUPPLY_ENTRY: '/entrada-insumos',
  INVENTORY: '/inventario',
  EXPORT: '/exportar-inventario',
  SETTINGS: '/configuracion',
  MASTER_CATALOG: '/catalogo-maestro',
  CLINIC_SUPERVISION: '/supervision-clinicas',
  USERS_MANAGE: '/usuarios',
  CLINICS_MANAGE: '/clinicas',

  // Rutas complementarias / existentes
  DASHBOARD: '/dashboard',
  SYNC: '/sync',

  // Fallback
  NOT_FOUND: '*',
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES]
