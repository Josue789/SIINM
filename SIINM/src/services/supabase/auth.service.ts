import { supabase } from './client'
import type { User, AuthSession } from '../../types/auth.types'

export const authService = {
  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) return null

      const sbUser = data.session.user
      const user: User = {
        id: sbUser.id,
        email: sbUser.email || '',
        fullName: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0],
        role: sbUser.user_metadata?.role || 'pharmacist',
      }

      return {
        user,
        token: data.session.access_token,
        expiresAt: data.session.expires_at,
      }
    } catch {
      return null
    }
  },

  async signInWithPassword(email: string, password: string):Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) return { user: null, error: new Error(error.message) }

      const sbUser = data.user
      const user: User = {
        id: sbUser.id,
        email: sbUser.email || '',
        fullName: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0],
        role: sbUser.user_metadata?.role || 'pharmacist',
      }

      return { user, error: null }
    } catch (err: unknown) {
      return { user: null, error: err instanceof Error ? err : new Error('Error al iniciar sesión') }
    }
  },

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('Error closing supabase session:', error)
    }
  },
}
