import { supabase } from './client'
import type { User, AuthSession, PerfilUsuario, UserRole } from '../../types/auth.types'

const CACHED_PROFILES_KEY = 'siinm_cached_profiles'
const CACHED_CLINICAS_KEY = 'siinm_cached_clinicas'
const CACHED_USER_STATUS_KEY = 'siinm_user_active_status'

export function getUserActiveStatusMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CACHED_USER_STATUS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveUserActiveStatus(userId: string, activo: boolean, email?: string): void {
  try {
    const current = getUserActiveStatusMap()
    if (userId) current[userId] = activo
    if (email) current[email.trim().toLowerCase()] = activo
    localStorage.setItem(CACHED_USER_STATUS_KEY, JSON.stringify(current))
  } catch {
    // ignore storage errors
  }
}

export function normalizeUserRole(rawRole: unknown): UserRole | undefined {
  if (typeof rawRole !== 'string') return undefined
  const cleaned = rawRole.trim().toLowerCase()
  if (cleaned === 'admin' || cleaned === 'administrador') return 'admin'
  if (cleaned === 'encargado') return 'encargado'
  if (cleaned === 'personal' || cleaned === 'farmacéutico' || cleaned === 'farmaceutico') {
    return 'Personal'
  }
  return undefined
}

export function getCachedProfiles(): Record<string, PerfilUsuario> {
  try {
    const raw = localStorage.getItem(CACHED_PROFILES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveCachedProfile(profile: PerfilUsuario): void {
  try {
    if (!profile?.id) return
    const current = getCachedProfiles()
    current[profile.id] = profile
    if (profile.email) {
      current[profile.email.trim().toLowerCase()] = profile
    }
    localStorage.setItem(CACHED_PROFILES_KEY, JSON.stringify(current))
  } catch {
    // ignore storage errors
  }
}

export function saveCachedProfiles(profiles: PerfilUsuario[]): void {
  try {
    const current = getCachedProfiles()
    for (const p of profiles) {
      if (p?.id) {
        current[p.id] = p
      }
      if (p?.email) {
        current[p.email.trim().toLowerCase()] = p
      }
    }
    localStorage.setItem(CACHED_PROFILES_KEY, JSON.stringify(current))
  } catch {
    // ignore storage errors
  }
}

export function getCachedClinicas(): Record<number, { id: number; nombre: string }> {
  try {
    const raw = localStorage.getItem(CACHED_CLINICAS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveCachedClinicas(clinicas: Array<{ id: number; nombre: string }>): void {
  try {
    const current = getCachedClinicas()
    for (const c of clinicas) {
      if (c?.id != null && c?.nombre) {
        current[Number(c.id)] = { id: Number(c.id), nombre: c.nombre }
      }
    }
    localStorage.setItem(CACHED_CLINICAS_KEY, JSON.stringify(current))
  } catch {
    // ignore storage errors
  }
}

function extractClinicaRelation(rawClinicas: unknown): { id: number; nombre: string } | undefined {
  if (!rawClinicas) return undefined
  const target = Array.isArray(rawClinicas) ? rawClinicas[0] : rawClinicas
  if (
    target &&
    typeof target === 'object' &&
    'id' in target &&
    'nombre' in target &&
    (target as { nombre?: unknown }).nombre
  ) {
    return {
      id: Number((target as { id: number | string }).id),
      nombre: String((target as { nombre: string }).nombre),
    }
  }
  return undefined
}

export const authService = {
  /**
   * Obtiene el nombre de una clínica por su ID desde Supabase o caché local.
   */
  async resolveClinicaById(clinicaId: number | null | undefined): Promise<{ id: number; nombre: string } | undefined> {
    if (clinicaId == null || isNaN(Number(clinicaId))) return undefined
    const numericId = Number(clinicaId)

    try {
      const { data, error } = await supabase
        .from('Clinicas')
        .select('id, nombre')
        .eq('id', numericId)
        .maybeSingle()

      if (!error && data && data.nombre) {
        const clinica = { id: Number(data.id), nombre: String(data.nombre) }
        saveCachedClinicas([clinica])
        return clinica
      }
    } catch {
      // Fallback a caché local
    }

    const cached = getCachedClinicas()[numericId]
    if (cached?.nombre) return cached

    // Buscar también en perfiles cacheados si alguno ya tiene resuelto el nombre de esa clínica
    const profiles = Object.values(getCachedProfiles())
    for (const p of profiles) {
      if (p?.clinica?.id != null && Number(p.clinica.id) === numericId && p.clinica.nombre) {
        const found = { id: numericId, nombre: p.clinica.nombre }
        saveCachedClinicas([found])
        return found
      }
    }

    return undefined
  },

  /**
   * Obtiene el perfil de un usuario desde la tabla Perfil_usuarios.
   * Incluye respaldos por email, consulta sin join, metadatos de Auth y caché local
   * en caso de restricciones RLS para usuarios no administradores.
   */
  async getUserProfile(
    userId: string,
    email?: string,
    userMetadata?: Record<string, unknown>
  ): Promise<PerfilUsuario | null> {
    try {
      let rawItem: Record<string, unknown> | null = null

      // 1. Intento principal por ID con join a Clinicas
      const { data, error } = await supabase
        .from('Perfil_usuarios')
        .select('*, Clinicas(id, nombre)')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        rawItem = data as unknown as Record<string, unknown>
      } else {
        if (error) {
          console.warn('[authService] Error al obtener perfil con join desde Perfil_usuarios:', error.message)
        }

        // 2. Intento por ID sin join a Clinicas (por si falla la relación o RLS de Clinicas)
        const { data: plainById, error: plainErr } = await supabase
          .from('Perfil_usuarios')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (!plainErr && plainById) {
          rawItem = plainById as unknown as Record<string, unknown>
        }
      }

      // 3. Si no se encontró por ID y tenemos el email, buscar por email
      const cleanEmail = (email || (userMetadata?.email as string) || '').trim()
      if (!rawItem && cleanEmail) {
        const { data: byEmail, error: emailErr } = await supabase
          .from('Perfil_usuarios')
          .select('*, Clinicas(id, nombre)')
          .ilike('email', cleanEmail)
          .maybeSingle()

        if (!emailErr && byEmail) {
          rawItem = byEmail as unknown as Record<string, unknown>
        } else {
          const { data: plainByEmail } = await supabase
            .from('Perfil_usuarios')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle()

          if (plainByEmail) {
            rawItem = plainByEmail as unknown as Record<string, unknown>
          }
        }
      }

      const statusMap = getUserActiveStatusMap()

      // 4. Si se obtuvo registro desde Supabase, normalizar y completar clínica
      if (rawItem) {
        const prevCached =
          getCachedProfiles()[userId] ||
          (cleanEmail ? getCachedProfiles()[cleanEmail.toLowerCase()] : undefined)

        const clinicaIdRaw =
          rawItem.clinica_id ??
          rawItem.umaps_id ??
          userMetadata?.clinica_id ??
          userMetadata?.umaps_id ??
          prevCached?.clinica_id ??
          null
        const clinicaId = clinicaIdRaw != null && clinicaIdRaw !== '' ? Number(clinicaIdRaw) : null

        let clinica = extractClinicaRelation(rawItem.Clinicas)
        if (!clinica && clinicaId != null) {
          clinica = await this.resolveClinicaById(clinicaId)
        }
        if (
          !clinica &&
          clinicaId != null &&
          prevCached?.clinica?.nombre &&
          (prevCached.clinica.id == null || Number(prevCached.clinica.id) === clinicaId)
        ) {
          clinica = { id: clinicaId, nombre: prevCached.clinica.nombre }
        }
        if (clinica) {
          saveCachedClinicas([clinica])
        }

        const resolvedId = String(rawItem.id || userId)
        const resolvedEmail = String(rawItem.email || cleanEmail || '')
        const isActivo =
          rawItem.activo !== undefined && rawItem.activo !== null
            ? Boolean(rawItem.activo)
            : statusMap[resolvedId] !== undefined
              ? statusMap[resolvedId]
              : resolvedEmail && statusMap[resolvedEmail.toLowerCase()] !== undefined
                ? statusMap[resolvedEmail.toLowerCase()]
                : prevCached?.activo !== undefined
                  ? prevCached.activo
                  : true

        saveUserActiveStatus(resolvedId, isActivo, resolvedEmail)

        const profile: PerfilUsuario = {
          id: resolvedId,
          email: resolvedEmail,
          nombre: String(
            rawItem.nombre ||
              (userMetadata?.nombre as string) ||
              (userMetadata?.full_name as string) ||
              prevCached?.nombre ||
              ''
          ),
          rol:
            normalizeUserRole(rawItem.rol) ||
            normalizeUserRole(userMetadata?.rol) ||
            normalizeUserRole(userMetadata?.role) ||
            normalizeUserRole(prevCached?.rol) ||
            'Personal',
          clinica_id: clinicaId,
          activo: isActivo,
          created_at: rawItem.created_at as string | undefined,
          clinica,
        }

        saveCachedProfile(profile)
        return profile
      }

      // 5. Respaldo desde caché local (útil si RLS bloquea lectura a no-admin o en modo offline)
      const cachedProfiles = getCachedProfiles()
      const cached =
        cachedProfiles[userId] ||
        (cleanEmail ? cachedProfiles[cleanEmail.toLowerCase()] : undefined)

      if (cached) {
        let clinica = cached.clinica
        if (!clinica && cached.clinica_id != null) {
          clinica = await this.resolveClinicaById(cached.clinica_id)
        }
        return {
          ...cached,
          rol: normalizeUserRole(cached.rol) || 'Personal',
          clinica,
        }
      }

      // 6. Respaldo desde user_metadata de Supabase Auth
      if (userMetadata && Object.keys(userMetadata).length > 0) {
        const metaClinicaIdRaw = userMetadata.clinica_id ?? userMetadata.umaps_id ?? null
        const metaClinicaId =
          metaClinicaIdRaw != null && metaClinicaIdRaw !== '' ? Number(metaClinicaIdRaw) : null
        const clinica =
          metaClinicaId != null ? await this.resolveClinicaById(metaClinicaId) : undefined

        const metaProfile: PerfilUsuario = {
          id: userId,
          email: cleanEmail,
          nombre: String(
            (userMetadata.nombre as string) ||
              (userMetadata.full_name as string) ||
              cleanEmail.split('@')[0] ||
              ''
          ),
          rol:
            normalizeUserRole(userMetadata.rol) ||
            normalizeUserRole(userMetadata.role) ||
            'Personal',
          clinica_id: metaClinicaId,
          clinica,
        }
        return metaProfile
      }

      return null
    } catch (err) {
      console.warn('[authService] Error inesperado al obtener perfil:', err)
      return null
    }
  },

  /**
   * Construye un objeto User unificando los datos de Supabase Auth con los de Perfil_usuarios.
   */
  buildUser(
    sbUser: {
      id: string
      email?: string
      fullName?: string
      role?: string
      clinicaId?: number | null
      clinicaNombre?: string
      activo?: boolean
      user_metadata?: Record<string, unknown>
    },
    profile?: Partial<PerfilUsuario> | null
  ): User {
    const meta = sbUser.user_metadata || {}
    const statusMap = getUserActiveStatusMap()
    const rawClinicaId =
      profile?.clinica_id ??
      (meta.clinica_id as number | string | null | undefined) ??
      (meta.umaps_id as number | string | null | undefined) ??
      sbUser.clinicaId ??
      null
    const clinicaId =
      rawClinicaId !== null && rawClinicaId !== undefined && rawClinicaId !== ''
        ? Number(rawClinicaId)
        : null

    const cachedClinicaNombre =
      clinicaId != null ? getCachedClinicas()[clinicaId]?.nombre : undefined

    const emailStr = profile?.email || sbUser.email || ''
    const activo =
      profile?.activo !== undefined
        ? profile.activo
        : statusMap[sbUser.id] !== undefined
          ? statusMap[sbUser.id]
          : emailStr && statusMap[emailStr.toLowerCase()] !== undefined
            ? statusMap[emailStr.toLowerCase()]
            : sbUser.activo !== undefined
              ? sbUser.activo
              : true

    return {
      id: sbUser.id,
      email: emailStr,
      fullName:
        profile?.nombre ||
        (meta.nombre as string) ||
        (meta.full_name as string) ||
        sbUser.fullName ||
        sbUser.email?.split('@')[0],
      role:
        normalizeUserRole(profile?.rol) ||
        normalizeUserRole(meta.rol) ||
        normalizeUserRole(meta.role) ||
        normalizeUserRole(sbUser.role) ||
        'Personal',
      clinicaId,
      clinicaNombre:
        profile?.clinica?.nombre ||
        (meta.clinica_nombre as string) ||
        (meta.clinicaNombre as string) ||
        sbUser.clinicaNombre ||
        cachedClinicaNombre,
      activo,
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
      const profile = await this.getUserProfile(sbUser.id, sbUser.email, sbUser.user_metadata)
      const user = this.buildUser(sbUser, profile)

      if (user.activo === false) {
        await supabase.auth.signOut()
        return null
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
      const profile = await this.getUserProfile(sbUser.id, sbUser.email, sbUser.user_metadata)
      const user = this.buildUser(sbUser, profile)

      if (user.activo === false) {
        await supabase.auth.signOut()
        return {
          user: null,
          session: null,
          error: new Error('Esta cuenta de usuario se encuentra desactivada. Contacta al administrador.'),
        }
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
   * Envía un correo de restablecimiento de contraseña mediante Supabase Auth.
   */
  async sendPasswordResetEmail(email: string): Promise<{ error: Error | null }> {
    try {
      const redirectTo = `${window.location.origin}/login`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      if (error) {
        return { error: new Error(error.message) }
      }
      return { error: null }
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err : new Error('Error al enviar correo de recuperación'),
      }
    }
  },

  /**
   * Actualiza la contraseña del usuario actualmente autenticado (ej. tras clic en enlace de correo).
   */
  async updateOwnPassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) {
        return { error: new Error(error.message) }
      }
      return { error: null }
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err : new Error('Error al actualizar la contraseña'),
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
            nombre: fullName?.trim() || email.split('@')[0],
            role: 'Personal',
            rol: 'Personal',
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
      const profile = await this.getUserProfile(sbUser.id, sbUser.email, sbUser.user_metadata)
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
