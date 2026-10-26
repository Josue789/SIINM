import { supabase } from '@/services/supabase/client'
import type { PerfilUsuario, UserRole } from '@/types/auth.types'

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
      .select('id, nombre, rol, email, clinica_id, created_at, Clinicas(id, nombre)')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('[userRepository] Error al obtener usuarios:', error)
      throw new Error(`Error al obtener usuarios: ${error.message}`)
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      email: item.email || item.email || '',
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
    }))
  },

  /**
   * Obtiene un perfil de usuario por su ID (UUID de Supabase Auth).
   */
  async getById(id: string): Promise<PerfilUsuario | null> {
    const { data, error } = await supabase
      .from('Perfil_usuarios')
      .select('id, nombre, rol, email, clinica_id, created_at, Clinicas(id, nombre)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error(`[userRepository] Error al obtener usuario ${id}:`, error)
      throw new Error(`Error al obtener usuario: ${error.message}`)
    }

    if (!data) return null

    const item: any = data
    return {
      id: item.id,
      email: item.email || item.email || '',
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
  },

  /**
   * Crea un nuevo usuario invocando la Edge Function 'crear-usuario'.
   * Ésta se encarga de crear el usuario en auth.users y en la tabla de perfiles.
   */
  async create(data: CreateUserDTO): Promise<any> {
    const { data: result, error } = await supabase.functions.invoke('crear-usuario', {
      body: {
        email: data.email.trim(),
        password: data.password,
        nombre: data.nombre.trim(),
        clinica_id: data.clinica_id ?? null,
        umaps_id: data.clinica_id ?? null, // Compatibilidad con el parámetro de la Edge Function
        rol: data.rol || 'Personal',
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
    if (updates.rol !== undefined) payload.rol = updates.rol
    if (updates.clinica_id !== undefined) payload.clinica_id = updates.clinica_id

    const { error } = await supabase
      .from('Perfil_usuarios')
      .update(payload)
      .eq('id', id)

    if (error) {
      console.error(`[userRepository] Error al actualizar usuario ${id}:`, error)
      throw new Error(`Error al actualizar usuario: ${error.message}`)
    }
  },

  /**
   * Elimina un usuario de la tabla Perfil_usuarios por su ID.
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('Perfil_usuarios')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(`[userRepository] Error al eliminar usuario ${id}:`, error)
      throw new Error(`Error al eliminar usuario: ${error.message}`)
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
