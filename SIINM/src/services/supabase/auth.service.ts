import { supabase } from './client'
import type { User, AuthSession, PerfilUsuario, UserRole } from '../../types/auth.types'

export const authService = {
  /**
   * Obtiene el perfil de un usuario desde la tabla Perfil_usuarios.
   */
  async getUserProfile(userId: string): Promise<PerfilUsuario | null> {
    try {
      const { data, error } = await supabase
        .from('Perfil_usuarios')
        .select('id, nombre, rol, email, clinica_id, created_at, Clinicas(id, nombre)')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('[authService] Error al obtener perfil desde Perfil_usuarios:', error.message)
        return null
      }

      if (!data) return null

      const item = data as unknown as {
        id: string
        email?: string
        nombre?: string
        rol?: UserRole
        clinica_id?: number | null
        created_at?: string
        Clinicas?: {
          id: number
          nombre: string
        }
      }

      return {
        id: item.id,
        email: item.email || '',
        nombre: item.nombre || '',
        rol: (item.rol as UserRole) || 'Personal',
        clinica_id: item.clinica_id,
        created_at: item.created_at,
        clinica: item.Clinicas
          ? {
              id: item.Clinicas.id,
              nombre: item.Clinicas.nombre,
            }
          : undefined,
      }
    } catch (err) {
      console.warn('[authService] Error inesperado al obtener perfil:', err)
      return null
    }
  },

  /**
   * Construye un objeto User unificando los datos de Supabase Auth con los de Perfil_usuarios.
   */
  buildUser(
    sbUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
    profile?: Partial<PerfilUsuario> | null
  ): User {
    return {
      id: sbUser.id,
      email: profile?.email || sbUser.email || '',
      fullName: profile?.nombre || (sbUser.user_metadata?.full_name as string) || sbUser.email?.split('@')[0],
      role: (profile?.rol as UserRole) || (sbUser.user_metadata?.role as UserRole) || 'Personal',
      clinicaId: profile?.clinica_id ?? null,
      clinicaNombre: profile?.clinica?.nombre,
    }
  },

  /**
   * Obtiene la sesión real activa persistida en Supabase.
   */
  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) return null

      const sbUser = data.session.user
      const profile = await this.getUserProfile(sbUser.id)
      const user = this.buildUser(sbUser, profile)

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
      const profile = await this.getUserProfile(sbUser.id)
      const user = this.buildUser(sbUser, profile)

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
            role: 'Personal',
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
      const profile = await this.getUserProfile(sbUser.id)
      const user = this.buildUser(sbUser, profile)

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
