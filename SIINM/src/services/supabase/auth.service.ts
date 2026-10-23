import { supabase } from './client'
import type { User, AuthSession } from '../../types/auth.types'

export const authService = {
  /**
   * Obtiene la sesión real activa persistida en Supabase.
   */
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

  /**
   * Inicia sesión directamente en Supabase con email y contraseña reales.
   */
  async signInWithPassword(
    email: string,
    password: string
  ): Promise<{ user: User | null; session: AuthSession | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        return { user: null, session: null, error: new Error(error.message) }
      }

      if (!data.user || !data.session) {
        return { user: null, session: null, error: new Error('No se pudo iniciar sesión en Supabase') }
      }

      const sbUser = data.user
      const user: User = {
        id: sbUser.id,
        email: sbUser.email || '',
        fullName: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0],
        role: sbUser.user_metadata?.role || 'pharmacist',
      }

      const session: AuthSession = {
        user,
        token: data.session.access_token,
        expiresAt: data.session.expires_at,
      }

      return { user, session, error: null }
    } catch (err: unknown) {
      return {
        user: null,
        session: null,
        error: err instanceof Error ? err : new Error('Error al conectar con Supabase Auth'),
      }
    }
  },

  /**
   * Registra un nuevo usuario directamente en Supabase Auth.
   */
  async signUp(
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ user: User | null; session: AuthSession | null; error: Error | null; needsEmailConfirmation?: boolean }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName?.trim() || email.split('@')[0],
            role: 'pharmacist',
          },
        },
      })

      if (error) {
        return { user: null, session: null, error: new Error(error.message) }
      }

      if (!data.user) {
        return { user: null, session: null, error: new Error('No se pudo crear el usuario') }
      }

      const sbUser = data.user
      const user: User = {
        id: sbUser.id,
        email: sbUser.email || '',
        fullName: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0],
        role: sbUser.user_metadata?.role || 'pharmacist',
      }

      const session: AuthSession | null = data.session
        ? {
            user,
            token: data.session.access_token,
            expiresAt: data.session.expires_at,
          }
        : null

      return {
        user,
        session,
        error: null,
        needsEmailConfirmation: !data.session,
      }
    } catch (err: unknown) {
      return {
        user: null,
        session: null,
        error: err instanceof Error ? err : new Error('Error al registrar usuario en Supabase'),
      }
    }
  },

  /**
   * Cierra la sesión activa en Supabase.
   */
  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('Error al cerrar sesión en Supabase:', error)
    }
  },
}
