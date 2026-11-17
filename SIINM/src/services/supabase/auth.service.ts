import { supabase } from './client'
import type { User, AuthSession, PerfilUsuario, UserRole } from '../../types/auth.types'

const CACHED_PROFILES_KEY = 'siinm_cached_profiles'
const CACHED_CLINICAS_KEY = 'siinm_cached_clinicas'
const CACHED_USER_STATUS_KEY = 'siinm_user_active_status'
const OFFLINE_AUTH_RECORDS_KEY = 'siinm_offline_auth_records_v1'
const ACTIVE_OFFLINE_SESSION_KEY = 'siinm_active_offline_session_v1'
const TEMP_PASSWORD_HASHES_KEY = 'siinm_temp_password_hashes_v1'
const MUST_CHANGE_PASSWORD_KEY = 'siinm_must_change_password_v1'
const OFFLINE_INTEGRITY_SECRET = 'SIINM_OFFLINE_AUTH_INTEGRITY_2026_V1'

export function setMustChangePasswordFlag(email: string, mustChange: boolean): void {
  if (!email) return
  try {
    const raw = localStorage.getItem(MUST_CHANGE_PASSWORD_KEY)
    const map: Record<string, boolean> = raw ? JSON.parse(raw) : {}
    const key = email.trim().toLowerCase()
    if (mustChange) {
      map[key] = true
    } else {
      delete map[key]
    }
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, JSON.stringify(map))
  } catch {
    // ignore storage errors
  }
}

export function getMustChangePasswordFlag(email?: string): boolean {
  if (!email) return false
  try {
    const raw = localStorage.getItem(MUST_CHANGE_PASSWORD_KEY)
    if (!raw) return false
    const map: Record<string, boolean> = JSON.parse(raw)
    return Boolean(map[email.trim().toLowerCase()])
  } catch {
    return false
  }
}

/**
 * Calcula un hash SHA-256 determinístico para validar una clave temporal asociada a un correo.
 */
export async function computeTempPasswordHash(email: string, tempPassword: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase()
  const cleanPass = tempPassword.trim()
  const fullHash = await sha256Hex(`${OFFLINE_INTEGRITY_SECRET}:temp_pwd:${cleanEmail}:${cleanPass}`)
  return fullHash.slice(0, 32)
}

export function saveLocalTempPasswordHash(email: string, hash: string): void {
  try {
    const raw = localStorage.getItem(TEMP_PASSWORD_HASHES_KEY)
    const map: Record<string, { hash: string; createdAt: number }> = raw ? JSON.parse(raw) : {}
    map[email.trim().toLowerCase()] = { hash, createdAt: Date.now() }
    localStorage.setItem(TEMP_PASSWORD_HASHES_KEY, JSON.stringify(map))
  } catch {
    // ignore storage errors
  }
}

export function getLocalTempPasswordHash(email?: string): string | null {
  if (!email) return null
  try {
    const raw = localStorage.getItem(TEMP_PASSWORD_HASHES_KEY)
    if (!raw) return null
    const map: Record<string, { hash: string; createdAt: number }> = JSON.parse(raw)
    const entry = map[email.trim().toLowerCase()]
    if (!entry) return null
    // Expira en 48 horas
    if (Date.now() - entry.createdAt > 48 * 60 * 60 * 1000) return null
    return entry.hash
  } catch {
    return null
  }
}

export function clearLocalTempPasswordHash(email?: string): void {
  if (!email) return
  try {
    const raw = localStorage.getItem(TEMP_PASSWORD_HASHES_KEY)
    if (!raw) return
    const map: Record<string, { hash: string; createdAt: number }> = JSON.parse(raw)
    delete map[email.trim().toLowerCase()]
    localStorage.setItem(TEMP_PASSWORD_HASHES_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

/**
 * Tiempo de vigencia para permitir inicio de sesión offline antes de obligar
 * a una revalidación en línea (7 días).
 */
export const OFFLINE_AUTH_TTL_DAYS = 7
export const OFFLINE_AUTH_TTL_MS = OFFLINE_AUTH_TTL_DAYS * 24 * 60 * 60 * 1000

export interface OfflineAuthRecord {
  email: string
  user: User
  salt: string
  credentialHash: string
  verifiedOnlineAt: number
  offlineExpiresAt: number
  integritySignature: string
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function computeCredentialHash(
  email: string,
  password: string,
  salt: string
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase()
  return await sha256Hex(`${OFFLINE_INTEGRITY_SECRET}:cred:${normalizedEmail}:${salt}:${password}`)
}

async function computeOfflineRecordSignature(
  payload: Omit<OfflineAuthRecord, 'integritySignature'>
): Promise<string> {
  const canonical = JSON.stringify({
    secret: OFFLINE_INTEGRITY_SECRET,
    email: payload.email.trim().toLowerCase(),
    user: {
      id: payload.user.id,
      email: payload.user.email,
      fullName: payload.user.fullName || '',
      role: payload.user.role || 'Personal',
      clinicaId: payload.user.clinicaId ?? null,
      clinicaNombre: payload.user.clinicaNombre || '',
      activo: payload.user.activo !== false,
    },
    salt: payload.salt,
    credentialHash: payload.credentialHash,
    verifiedOnlineAt: payload.verifiedOnlineAt,
    offlineExpiresAt: payload.offlineExpiresAt,
  })
  return await sha256Hex(canonical)
}

function getOfflineAuthRecordsMap(): Record<string, OfflineAuthRecord> {
  try {
    const raw = localStorage.getItem(OFFLINE_AUTH_RECORDS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setOfflineAuthRecordsMap(records: Record<string, OfflineAuthRecord>): void {
  try {
    localStorage.setItem(OFFLINE_AUTH_RECORDS_KEY, JSON.stringify(records))
  } catch {
    // ignore storage errors
  }
}

export function getOfflineAuthRecordByEmail(email?: string): OfflineAuthRecord | null {
  if (!email) return null
  const key = email.trim().toLowerCase()
  const map = getOfflineAuthRecordsMap()
  return map[key] || null
}

export function revokeOfflineAuthRecord(email?: string): void {
  if (!email) return
  const key = email.trim().toLowerCase()
  const map = getOfflineAuthRecordsMap()
  if (map[key]) {
    delete map[key]
    setOfflineAuthRecordsMap(map)
  }
  try {
    const activeRaw = localStorage.getItem(ACTIVE_OFFLINE_SESSION_KEY)
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw) as { email?: string }
      if (parsed.email?.trim().toLowerCase() === key) {
        localStorage.removeItem(ACTIVE_OFFLINE_SESSION_KEY)
      }
    }
  } catch {
    // ignore
  }
}

export function clearActiveOfflineSession(): void {
  try {
    localStorage.removeItem(ACTIVE_OFFLINE_SESSION_KEY)
  } catch {
    // ignore
  }
}

async function saveOfflineAuthRecordOnOnlineLogin(user: User, password: string): Promise<void> {
  if (!user.email) return
  if (user.activo === false) {
    revokeOfflineAuthRecord(user.email)
    return
  }

  const normalizedEmail = user.email.trim().toLowerCase()
  const salt = generateSalt()
  const credentialHash = await computeCredentialHash(normalizedEmail, password, salt)
  const now = Date.now()
  const offlineExpiresAt = now + OFFLINE_AUTH_TTL_MS

  const unsignedRecord: Omit<OfflineAuthRecord, 'integritySignature'> = {
    email: normalizedEmail,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      clinicaId: user.clinicaId ?? null,
      clinicaNombre: user.clinicaNombre,
      activo: true,
    },
    salt,
    credentialHash,
    verifiedOnlineAt: now,
    offlineExpiresAt,
  }

  const integritySignature = await computeOfflineRecordSignature(unsignedRecord)
  const map = getOfflineAuthRecordsMap()
  map[normalizedEmail] = {
    ...unsignedRecord,
    integritySignature,
  }
  setOfflineAuthRecordsMap(map)
}

export async function syncOfflineRecordProfile(user: User, extendExpiration = false): Promise<void> {
  if (!user?.email) return
  const normalizedEmail = user.email.trim().toLowerCase()
  if (user.activo === false) {
    revokeOfflineAuthRecord(normalizedEmail)
    return
  }

  const map = getOfflineAuthRecordsMap()
  const existing = map[normalizedEmail]
  if (!existing) return

  const now = Date.now()
  const unsignedRecord: Omit<OfflineAuthRecord, 'integritySignature'> = {
    ...existing,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      clinicaId: user.clinicaId ?? null,
      clinicaNombre: user.clinicaNombre,
      activo: true,
    },
    verifiedOnlineAt: extendExpiration ? now : existing.verifiedOnlineAt,
    offlineExpiresAt: extendExpiration ? now + OFFLINE_AUTH_TTL_MS : existing.offlineExpiresAt,
  }

  const integritySignature = await computeOfflineRecordSignature(unsignedRecord)
  map[normalizedEmail] = {
    ...unsignedRecord,
    integritySignature,
  }
  setOfflineAuthRecordsMap(map)
}

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
      mustChangePassword:
        Boolean(meta.must_change_password) || getMustChangePasswordFlag(emailStr),
    }
  },

  /**
   * Valida y recupera una sesión offline activa si existe y no ha expirado.
   */
  async getValidActiveOfflineSession(): Promise<AuthSession | null> {
    try {
      const rawActive = localStorage.getItem(ACTIVE_OFFLINE_SESSION_KEY)
      if (!rawActive) return null

      const parsed = JSON.parse(rawActive) as { email?: string; token?: string }
      const emailKey = parsed?.email?.trim().toLowerCase()
      if (!emailKey) {
        clearActiveOfflineSession()
        return null
      }

      const record = getOfflineAuthRecordByEmail(emailKey)
      if (!record) {
        clearActiveOfflineSession()
        return null
      }

      // Verificar integridad criptográfica del registro guardado
      const expectedSig = await computeOfflineRecordSignature({
        email: record.email,
        user: record.user,
        salt: record.salt,
        credentialHash: record.credentialHash,
        verifiedOnlineAt: record.verifiedOnlineAt,
        offlineExpiresAt: record.offlineExpiresAt,
      })

      if (expectedSig !== record.integritySignature) {
        revokeOfflineAuthRecord(emailKey)
        return null
      }

      if (record.user.activo === false) {
        revokeOfflineAuthRecord(emailKey)
        return null
      }

      // Verificar si la vigencia offline ya expiró
      if (Date.now() > record.offlineExpiresAt) {
        clearActiveOfflineSession()
        return null
      }

      return {
        user: record.user,
        token: parsed.token || `offline_${record.integritySignature.slice(0, 24)}`,
        expiresAt: Math.floor(record.offlineExpiresAt / 1000),
      }
    } catch {
      clearActiveOfflineSession()
      return null
    }
  },

  /**
   * Verifica credenciales de forma offline contra el registro previamente validado en línea.
   * Obliga a que el primer inicio de sesión haya sido online y que la vigencia no haya expirado.
   */
  async authenticateOffline(
    email: string,
    password: string
  ): Promise<{ user: User | null; session: AuthSession | null; error: Error | null }> {
    const normalizedEmail = email.trim().toLowerCase()
    const record = getOfflineAuthRecordByEmail(normalizedEmail)

    if (!record) {
      return {
        user: null,
        session: null,
        error: new Error(
          'El primer inicio de sesión en este dispositivo debe realizarse obligatoriamente con conexión a Internet.'
        ),
      }
    }

    // 1. Verificar firma de integridad contra manipulaciones en localStorage
    const expectedSig = await computeOfflineRecordSignature({
      email: record.email,
      user: record.user,
      salt: record.salt,
      credentialHash: record.credentialHash,
      verifiedOnlineAt: record.verifiedOnlineAt,
      offlineExpiresAt: record.offlineExpiresAt,
    })

    if (expectedSig !== record.integritySignature) {
      revokeOfflineAuthRecord(normalizedEmail)
      return {
        user: null,
        session: null,
        error: new Error(
          'Los datos locales de acceso fueron alterados. Conéctate a Internet para volver a validar tu cuenta.'
        ),
      }
    }

    // 2. Verificar que la cuenta esté activa según la última sincronización
    if (record.user.activo === false) {
      revokeOfflineAuthRecord(normalizedEmail)
      return {
        user: null,
        session: null,
        error: new Error(
          'Esta cuenta de usuario se encuentra desactivada. Contacta al administrador.'
        ),
      }
    }

    // 3. Verificar fecha de expiración del acceso offline
    const now = Date.now()
    if (now > record.offlineExpiresAt) {
      clearActiveOfflineSession()
      const expiredDateStr = new Date(record.offlineExpiresAt).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      return {
        user: null,
        session: null,
        error: new Error(
          `Tu vigencia de acceso sin conexión expiró el ${expiredDateStr}. Conéctate a Internet para validar tus accesos y actualizar tus datos.`
        ),
      }
    }

    // 4. Verificar hash de contraseña con su salt
    const candidateHash = await computeCredentialHash(normalizedEmail, password, record.salt)
    if (candidateHash !== record.credentialHash) {
      return {
        user: null,
        session: null,
        error: new Error('Las credenciales son incorrectas'),
      }
    }

    const token = `offline_${record.integritySignature.slice(0, 24)}`
    try {
      localStorage.setItem(
        ACTIVE_OFFLINE_SESSION_KEY,
        JSON.stringify({
          email: normalizedEmail,
          token,
          startedAt: now,
        })
      )
    } catch {
      // ignore storage errors
    }

    const session: AuthSession = {
      user: record.user,
      token,
      expiresAt: Math.floor(record.offlineExpiresAt / 1000),
    }

    return { user: record.user, session, error: null }
  },

  /**
   * Obtiene la sesión real activa persistida en Supabase o la sesión offline vigente.
   */
  async getCurrentSession(): Promise<AuthSession | null> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    try {
      const { data, error } = await supabase.auth.getSession()
      if (!error && data.session) {
        const sbUser = data.session.user
        const emailKey = sbUser.email?.trim().toLowerCase()

        // Si estamos sin conexión, verificar que la vigencia offline del usuario no haya expirado
        if (!isOnline && emailKey) {
          const offlineRecord = getOfflineAuthRecordByEmail(emailKey)
          if (offlineRecord && Date.now() > offlineRecord.offlineExpiresAt) {
            clearActiveOfflineSession()
            return null
          }
        }

        const profile = await this.getUserProfile(sbUser.id, sbUser.email, sbUser.user_metadata)
        const user = this.buildUser(sbUser, profile)

        if (user.activo === false) {
          revokeOfflineAuthRecord(user.email)
          await supabase.auth.signOut()
          return null
        }

        // Si estamos en línea, actualizar los datos y extender la vigencia offline
        if (isOnline) {
          await syncOfflineRecordProfile(user, true)
        }

        return {
          user,
          token: data.session.access_token,
          expiresAt: data.session.expires_at,
        }
      }
    } catch {
      // Fallback a sesión offline
    }

    return await this.getValidActiveOfflineSession()
  },

  /**
   * Inicia sesión en Supabase cuando hay Internet (guardando credenciales cifradas y fecha de expiración),
   * o valida el acceso offline si no hay conexión y existe un registro previo vigente.
   */
  async signInWithPassword(
    email: string,
    password: string
  ): Promise<{ user: User | null; session: AuthSession | null; error: Error | null }> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    // Si el dispositivo no tiene internet, usar directamente el validador offline
    if (!isOnline) {
      return await this.authenticateOffline(email, password)
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        const msgLower = error.message.toLowerCase()
        const isNetworkError =
          msgLower.includes('fetch') ||
          msgLower.includes('network') ||
          msgLower.includes('failed to fetch') ||
          msgLower.includes('load failed')

        if (isNetworkError) {
          return await this.authenticateOffline(email, password)
        }

        return { user: null, session: null, error: new Error(error.message) }
      }

      if (!data.user || !data.session) {
        return { user: null, session: null, error: new Error('No se pudo iniciar sesión en Supabase') }
      }

      const sbUser = data.user
      const cleanEmail = (sbUser.email || email).trim()
      const cleanPass = password.trim()

      // Detectar si el usuario inició sesión utilizando una clave temporal
      const localTempHash = getLocalTempPasswordHash(cleanEmail)
      const enteredHash = localTempHash
        ? await computeTempPasswordHash(cleanEmail, cleanPass)
        : ''
      const usedTemporaryPassword =
        cleanPass.startsWith('Siinm-') ||
        (Boolean(localTempHash) && enteredHash === localTempHash) ||
        Boolean(sbUser.user_metadata?.must_change_password)

      if (usedTemporaryPassword) {
        setMustChangePasswordFlag(cleanEmail, true)
        await supabase.auth
          .updateUser({
            data: { must_change_password: true },
          })
          .catch(() => null)
      }

      const profile = await this.getUserProfile(sbUser.id, sbUser.email, sbUser.user_metadata)
      const user = this.buildUser(sbUser, profile)
      if (usedTemporaryPassword) {
        user.mustChangePassword = true
      }

      if (user.activo === false) {
        revokeOfflineAuthRecord(user.email)
        await supabase.auth.signOut()
        return {
          user: null,
          session: null,
          error: new Error('Esta cuenta de usuario se encuentra desactivada. Contacta al administrador.'),
        }
      }

      // Guardar perfil validado en línea + hash de contraseña + nueva fecha de expiración offline
      await saveOfflineAuthRecordOnOnlineLogin(user, password)

      // También dejar respaldada la sesión offline activa por si pierde conexión más adelante
      try {
        localStorage.setItem(
          ACTIVE_OFFLINE_SESSION_KEY,
          JSON.stringify({
            email: user.email.trim().toLowerCase(),
            token: data.session.access_token,
            startedAt: Date.now(),
          })
        )
      } catch {
        // ignore
      }

      const session: AuthSession = {
        user,
        token: data.session.access_token,
        expiresAt: data.session.expires_at,
      }

      return { user, session, error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const isNetworkErr =
        !navigator.onLine ||
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('network')

      if (isNetworkErr) {
        return await this.authenticateOffline(email, password)
      }

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
      const redirectTo = `${window.location.origin}/restablecer-contrasena`
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
   * Actualiza la contraseña del usuario actualmente autenticado (ej. tras clic en enlace de correo o con clave temporal).
   */
  async updateOwnPassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      })
      if (error) {
        return { error: new Error(error.message) }
      }
      if (data.user) {
        if (data.user.email) {
          setMustChangePasswordFlag(data.user.email, false)
          clearLocalTempPasswordHash(data.user.email)
        }
        const profile = await this.getUserProfile(
          data.user.id,
          data.user.email,
          data.user.user_metadata
        )
        const built = this.buildUser(data.user, profile)
        built.mustChangePassword = false
        await saveOfflineAuthRecordOnOnlineLogin(built, newPassword)
      }
      return { error: null }
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err : new Error('Error al actualizar la contraseña'),
      }
    }
  },

  /**
   * Elimina un usuario directamente en Supabase Auth
   */
  async deleteUser(id: string): Promise<{error:Error | null}>{
    try{
      const {error} = await supabase.functions.invoke('delete-user',{
        body:{userId: id},
      })

      if(error) throw error;

      return {error: null};
    }catch (error){
      return {error: error as Error};
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
   * Cierra la sesión activa en Supabase y limpia la sesión offline activa (conservando el registro para futuros logins offline vigentes).
   */
  async signOut(): Promise<void> {
    clearActiveOfflineSession()
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('Error al cerrar sesión en Supabase:', error)
    }
  },
}
