import { createClient } from '@supabase/supabase-js'
import { ENV } from '../../config/env'

// Instancia del cliente de Supabase
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
