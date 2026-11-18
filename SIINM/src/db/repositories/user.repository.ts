import { supabase } from '@/services/supabase/client'
import {
  normalizeUserRole,
  saveCachedProfile,
  saveCachedProfiles,
  saveCachedClinicas,
  getCachedClinicas,
  getUserActiveStatusMap,
  saveUserActiveStatus,
  getCachedProfiles,
  authService,
  computeTempPasswordHash,
  saveLocalTempPasswordHash,
  setMustChangePasswordFlag,
} from '@/services/supabase/auth.service'
import type { PerfilUsuario, UserRole } from '@/types/auth.types'
import { toast } from 'react-toastify'

export type CreateUserDTO = {
  email: string
  password: string
  nombre: string
  rol: UserRole
  clinica_id?: number | null
}

export type UpdateUserDTO = {
  nombre?: string
  email?: string
  rol?: UserRole
  clinica_id?: number | null
  activo?: boolean
}

function mapClinicaFromItem(rawClinicas: any, clinicaId?: number | null) {
  const target = Array.isArray(rawClinicas) ? rawClinicas[0] : rawClinicas
  if (target && target.id != null && target.nombre) {
    const clinica = {
      id: Number(target.id),
      nombre: String(target.nombre),
    }
    saveCachedClinicas([clinica])
    return clinica
  }
  if (clinicaId != null) {
    const cached = getCachedClinicas()[Number(clinicaId)]
    if (cached) return cached
  }
  return undefined
}

/**
 * Repositorio de Usuarios conectado con Supabase (Perfil_usuarios)
 * y la Edge Function 'crear-usuario' para el aprovisionamiento en auth.users.
 */
export const userRepository = {
  /**
   * Obtiene todos los perfiles de usuario junto con su clínica asignada.
   */
  async getAll(): Promise<PerfilUsuario[]> {
    const { data, error } = await supabase
      .from('Perfil_usuarios')
      .select('*, Clinicas(id, nombre)')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('[userRepository] Error al obtener usuarios:', error)
      throw new Error(`Error al obtener usuarios: ${error.message}`)
    }

    const statusMap = getUserActiveStatusMap()

    const profiles: PerfilUsuario[] = (data || []).map((item: any) => {
      const emailStr = item.email || ''
      const isActivo =
        item.activo !== undefined && item.activo !== null
          ? Boolean(item.activo)
          : statusMap[item.id] !== undefined
            ? statusMap[item.id]
            : emailStr && statusMap[emailStr.toLowerCase()] !== undefined
              ? statusMap[emailStr.toLowerCase()]
              : true

      saveUserActiveStatus(item.id, isActivo, emailStr)

      return {
        id: item.id,
        email: emailStr,
        nombre: item.nombre || '',
        rol: normalizeUserRole(item.rol) || 'Personal',
        clinica_id: item.clinica_id ?? null,
        activo: isActivo,
        created_at: item.created_at,
        clinica: mapClinicaFromItem(item.Clinicas, item.clinica_id),
      }
    })

    saveCachedProfiles(profiles)
    return profiles
  },

  /**
   * Obtiene un perfil de usuario por su ID (UUID de Supabase Auth).
   */
  async getById(id: string): Promise<PerfilUsuario | null> {
    const { data, error } = await supabase
      .from('Perfil_usuarios')
      .select('*, Clinicas(id, nombre)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error(`[userRepository] Error al obtener usuario ${id}:`, error)
      throw new Error(`Error al obtener usuario: ${error.message}`)
    }

    if (!data) return null
    const item: any = data
    const statusMap = getUserActiveStatusMap()
    const emailStr = item.email || ''
    const isActivo =
      item.activo !== undefined && item.activo !== null
        ? Boolean(item.activo)
        : statusMap[item.id] !== undefined
          ? statusMap[item.id]
          : emailStr && statusMap[emailStr.toLowerCase()] !== undefined
            ? statusMap[emailStr.toLowerCase()]
            : true

    saveUserActiveStatus(item.id, isActivo, emailStr)

    const profile: PerfilUsuario = {
      id: item.id,
      email: emailStr,
      nombre: item.nombre || '',
      rol: normalizeUserRole(item.rol) || 'Personal',
      clinica_id: item.clinica_id ?? null,
      activo: isActivo,
      created_at: item.created_at,
      clinica: mapClinicaFromItem(item.Clinicas, item.clinica_id),
    }

    saveCachedProfile(profile)
    return profile
  },

  /**
   * Crea un nuevo usuario invocando la Edge Function 'crear-usuario'.
   * Ésta se encarga de crear el usuario en auth.users y en la tabla de perfiles.
   */
  async create(data: CreateUserDTO): Promise<any> {
    const normalizedRol = normalizeUserRole(data.rol) || 'Personal'
    const cleanEmail = data.email.trim()
    const cleanNombre = data.nombre.trim()
    const targetClinicaId = data.clinica_id ?? null

    const { data: result, error } = await supabase.functions.invoke('crear-usuario', {
      body: {
        email: cleanEmail,
        password: data.password,
        nombre: cleanNombre,
        clinica_id: targetClinicaId,
        umaps_id: targetClinicaId, // Compatibilidad con el parámetro de la Edge Function
        rol: normalizedRol,
      },
    })

    if (error) {
      let detailedMessage = error.message
      try {
        if ('context' in error && (error as any).context) {
          const body = await (error as any).context.json()
          if (body?.error) detailedMessage = body.error
          else if (body?.message) detailedMessage = body.message
          else detailedMessage = JSON.stringify(body)
        }
      } catch {
        try {
          const text = await (error as any).context.text()
          if (text) detailedMessage = text
        } catch {
          // fallback a error.message
        }
      }
      console.error('[userRepository] Error al invocar crear-usuario:', detailedMessage, error)
      throw new Error(detailedMessage || 'Error al comunicarse con la función de creación de usuarios')
    }

    if (result?.error) {
      console.error('[userRepository] Error devuelto por la función:', result.error)
      throw new Error(result.error)
    }

    // Asegurar que en Perfil_usuarios queden guardados el rol y clinica_id correctos
    try {
      const createdUserId = result?.user?.id || result?.id || result?.data?.id
      if (createdUserId) {
        await supabase
          .from('Perfil_usuarios')
          .update({
            nombre: cleanNombre,
            email: cleanEmail,
            rol: normalizedRol,
            clinica_id: targetClinicaId,
          })
          .eq('id', createdUserId)

        saveCachedProfile({
          id: String(createdUserId),
          email: cleanEmail,
          nombre: cleanNombre,
          rol: normalizedRol,
          clinica_id: targetClinicaId,
          clinica: mapClinicaFromItem(null, targetClinicaId),
        })
      } else {
        await supabase
          .from('Perfil_usuarios')
          .update({
            nombre: cleanNombre,
            rol: normalizedRol,
            clinica_id: targetClinicaId,
          })
          .ilike('email', cleanEmail)
      }
    } catch (syncErr) {
      console.warn('[userRepository] No se pudo sincronizar perfil tras creación:', syncErr)
    }

    return result
  },

  /**
   * Actualiza el perfil de un usuario existente en la tabla Perfil_usuarios.
   */
  async update(id: string, updates: UpdateUserDTO): Promise<void> {
    const payload: Record<string, unknown> = {}

    if (updates.nombre !== undefined) payload.nombre = updates.nombre.trim()
    if (updates.email !== undefined) {
      payload.email = updates.email.trim()
    }
    if (updates.rol !== undefined) payload.rol = normalizeUserRole(updates.rol) || updates.rol
    if (updates.clinica_id !== undefined) payload.clinica_id = updates.clinica_id
    if (updates.activo !== undefined) payload.activo = updates.activo

    const { error } = await supabase
      .from('Perfil_usuarios')
      .update(payload)
      .eq('id', id)

    if (error) {
      console.error(`[userRepository] Error al actualizar usuario ${id}:`, error)
      throw new Error(`Error al actualizar usuario: ${error.message}`)
    }

    await this.getById(id).catch(() => null)
  },

  /**
   * Activa o desactiva un usuario en Supabase (Perfil_usuarios) y sincroniza su estado.
   */
  async updateStatus(id: string, activo: boolean, email?: string): Promise<void> {
    saveUserActiveStatus(id, activo, email)

    const cached = getCachedProfiles()[id]
    if (cached) {
      saveCachedProfile({ ...cached, activo })
    }

    const { error } = await supabase
      .from('Perfil_usuarios')
      .update({ activo })
      .eq('id', id)

    if (error) {
      const msg = error.message || ''
      // Si la columna 'activo' aún no existe en la tabla Perfil_usuarios, mantenemos el estado sincronizado y avisamos en consola
      if (msg.includes('activo') || error.code === '42703' || error.code === 'PGRST204') {
        console.warn(
          '[userRepository] La columna "activo" no existe aún en Perfil_usuarios. Ejecuta: ALTER TABLE public."Perfil_usuarios" ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;'
        )
        return
      }
      throw new Error(`Error al cambiar estatus del usuario: ${error.message}`)
    }
  },

  /**
   * Activa o desactiva todos los usuarios segun una clinica especificada
   */
  async updateStatusByClinic(clinicId: string, activo: boolean): Promise<void> {
    const { error } = await supabase
      .from('Perfil_usuarios')
      .update({ activo })
      .eq('clinica_id', clinicId)

    if (error) {
      const msg = error.message || ''
      // Si la columna 'activo' aún no existe en la tabla Perfil_usuarios, mantenemos el estado sincronizado y avisamos en consola
      if (msg.includes('activo') || error.code === '42703' || error.code === 'PGRST204') {
        console.warn(
          '[userRepository] La columna "activo" no existe aún en Perfil_usuarios. Ejecuta: ALTER TABLE public."Perfil_usuarios" ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;'
        )
        return
      }
      throw new Error(`Error al cambiar estatus del usuario: ${error.message}`)
    }
  },


  /**
   * Genera una contraseña temporal segura de al menos 10 caracteres.
   */
  generateTemporaryPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghijkmnpqrstuvwxyz'
    const digits = '23456789'
    const symbols = '#$@!*'
    const pick = (str: string) => str[Math.floor(Math.random() * str.length)]

    const randomPart = [
      pick(upper),
      pick(lower),
      pick(digits),
      pick(symbols),
      pick(upper),
      pick(lower),
      pick(digits),
      pick(lower),
    ].join('')

    return `Siinm-${randomPart}`
  },

  /**
   * Envía el correo de restablecimiento de contraseña con Supabase Auth
   * y opcionalmente intenta aplicar la clave temporal mediante Edge Function / RPC si está configurada.
   */
  async resetPasswordWithSupabase(params: {
    userId: string
    email: string
    tempPassword?: string
    sendEmail?: boolean
  }): Promise<{ emailSent: boolean; passwordUpdatedRemotely: boolean }> {
    const cleanEmail = params.email.trim()
    let passwordUpdatedRemotely = false
    let emailSent = false

    // 1. Si se proporcionó clave temporal, generar token de verificación y aplicar en Auth vía RPC o Edge Function
    let verificationHash = ''
    if (params.tempPassword && params.tempPassword.trim().length >= 6) {
      const newPassword = params.tempPassword.trim()
      verificationHash = await computeTempPasswordHash(cleanEmail, newPassword)
      saveLocalTempPasswordHash(cleanEmail, verificationHash)
      setMustChangePasswordFlag(cleanEmail, true)

      try {
        const { error: rpcError } = await supabase.rpc('admin_reset_user_password', {
          target_user_id: params.userId,
          new_password: newPassword,
        })
        if (!rpcError) {
          passwordUpdatedRemotely = true
        }
      } catch {
        // RPC opcional
      }

      if (!passwordUpdatedRemotely) {
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke(
            'actualizar-password',
            {
              body: {
                user_id: params.userId,
                id: params.userId,
                email: cleanEmail,
                password: newPassword,
              },
            }
          )
          if (!fnErr && !fnData?.error) {
            passwordUpdatedRemotely = true
          }
        } catch {
          // Edge function opcional
        }
      }
    }

    // 2. Enviar correo oficial de recuperación de contraseña de Supabase Auth apuntando a /restablecer-contrasena
    if (params.sendEmail !== false && cleanEmail) {
      const queryParams = new URLSearchParams()
      queryParams.set('email', cleanEmail)
      if (verificationHash) {
        queryParams.set('v', verificationHash)
      }
      const redirectTo = `${window.location.origin}/restablecer-contrasena?${queryParams.toString()}`
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      })

      if (error) {
        throw new Error(`Error al enviar correo de Supabase: ${error.message}`)
      }
      emailSent = true
    }

    return { emailSent, passwordUpdatedRemotely }
  },

  /**
   * Elimina un usuario de la tabla Perfil_usuarios por su ID.
   */
  async delete(id: string): Promise<void> {
    // Elimina de la tabla de Perfil_usuarios
    const { error: dbError } = await supabase
      .from('Perfil_usuarios')
      .delete()
      .eq('id', id)

    if (dbError) {
      toast.error(`[userRepository] Error al eliminar usuario ${id}:`)
      throw new Error(`Error al eliminar usuario: ${dbError.message}`)
    }

    // Elimina de supabase auth
    const {error: authError} = await authService.deleteUser(id);

    if(authError){
      toast.error(`[userRepository] Error al eliminar credenciales del usuario ${id}:`);
      throw new Error(`Error al eliminar usuario: ${authError.message}`)
    }
  },

  /**
   * Suscripción en tiempo real a cambios en la tabla Perfil_usuarios.
   */
  subscribe(onEvent: () => void): () => void {
    const channel = supabase
      .channel('perfil-usuarios-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Perfil_usuarios' },
        () => {
          onEvent()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel).catch(console.error)
    }
  },
}
