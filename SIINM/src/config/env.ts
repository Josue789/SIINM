export const ENV = {
  APP_NAME: 'SIINM',
  APP_FULL_NAME: 'Sistema Integral de Inventario Médico',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://demo-project.supabase.co',
  SUPABASE_ANON_KEY:
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    'demo-anon-key',
  IS_DEV: import.meta.env.DEV,
}
