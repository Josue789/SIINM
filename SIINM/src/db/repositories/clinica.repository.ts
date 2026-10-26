import { supabase } from '@/services/supabase/client'
import type { Clinica } from '@/types/inventory.types'

export type CreateClinicaDTO = {
  nombre: string
  ubicacion?: string
  telefono?: string
  clues?: string
  activo?: boolean
}

export type UpdateClinicaDTO = Partial<CreateClinicaDTO>

/**
 * Repositorio de Clínicas 100% online que interactúa directamente con Supabase.
 * Trabaja sobre la tabla 'Clinicas'.
 */
export const clinicaRepository = {
  /**
   * Obtiene la lista de clínicas desde Supabase.
   * @param options.onlyActive Si es true, filtra únicamente las clínicas activas.
   */
  async getAll(options?: { onlyActive?: boolean }): Promise<Clinica[]> {
    let query = supabase
      .from('Clinicas')
      .select('*')
      .order('nombre', { ascending: true })

    if (options?.onlyActive) {
      query = query.eq('activo', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('[clinicaRepository] Error al obtener clínicas:', error)
      throw new Error(`Error al obtener clínicas: ${error.message}`)
    }

    return (data as Clinica[]) || []
  },

  /**
   * Obtiene una clínica por su ID.
   */
  async getById(id: number | string): Promise<Clinica | null> {
    const { data, error } = await supabase
      .from('Clinicas')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle()

    if (error) {
      console.error(`[clinicaRepository] Error al obtener clínica ${id}:`, error)
      throw new Error(`Error al obtener clínica: ${error.message}`)
    }

    return data as Clinica | null
  },

  /**
   * Busca una clínica por su clave CLUES.
   */
  async getByClues(clues: string): Promise<Clinica | null> {
    const { data, error } = await supabase
      .from('Clinicas')
      .select('*')
      .eq('clues', clues.trim())
      .maybeSingle()

    if (error) {
      console.error(`[clinicaRepository] Error al buscar clínica por CLUES ${clues}:`, error)
      throw new Error(`Error al buscar por CLUES: ${error.message}`)
    }

    return data as Clinica | null
  },

  /**
   * Crea una nueva clínica en Supabase.
   */
  async create(data: CreateClinicaDTO): Promise<Clinica> {
    const payload = {
      nombre: data.nombre.trim(),
      ubicacion: data.ubicacion?.trim() || null,
      telefono: data.telefono?.trim() || null,
      clues: data.clues?.trim() || null,
      activo: data.activo !== undefined ? data.activo : true,
    }

    const { data: newClinic, error } = await supabase
      .from('Clinicas')
      .insert([payload])
      .select()
      .single()

    if (error) {
      console.error('[clinicaRepository] Error al crear clínica:', error)
      throw new Error(`Error al crear clínica: ${error.message}`)
    }

    return newClinic as Clinica
  },

  /**
   * Actualiza los datos de una clínica existente.
   */
  async update(id: number | string, updates: UpdateClinicaDTO): Promise<Clinica> {
    const payload: Record<string, unknown> = {}

    if (updates.nombre !== undefined) payload.nombre = updates.nombre.trim()
    if (updates.ubicacion !== undefined) payload.ubicacion = updates.ubicacion.trim() || null
    if (updates.telefono !== undefined) payload.telefono = updates.telefono.trim() || null
    if (updates.clues !== undefined) payload.clues = updates.clues.trim() || null
    if (updates.activo !== undefined) payload.activo = updates.activo

    const { data: updatedClinic, error } = await supabase
      .from('Clinicas')
      .update(payload)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) {
      console.error(`[clinicaRepository] Error al actualizar clínica ${id}:`, error)
      throw new Error(`Error al actualizar clínica: ${error.message}`)
    }

    return updatedClinic as Clinica
  },

  /**
   * Cambia el estatus (activo / inactivo) de una clínica.
   */
  async updateStatus(id: number | string, activo: boolean): Promise<Clinica> {
    return this.update(id, { activo })
  },

  /**
   * Elimina una clínica de Supabase por su ID.
   */
  async delete(id: number | string): Promise<void> {
    const { error } = await supabase
      .from('Clinicas')
      .delete()
      .eq('id', Number(id))

    if (error) {
      console.error(`[clinicaRepository] Error al eliminar clínica ${id}:`, error)
      throw new Error(`Error al eliminar clínica: ${error.message}`)
    }
  },

  /**
   * Suscripción en tiempo real a cambios de la tabla 'Clinicas'.
   * Retorna una función para cancelar la suscripción.
   */
  subscribe(onEvent: () => void): () => void {
    const channel = supabase
      .channel('clinicas-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Clinicas' },
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

// Exportación alternativa en inglés por conveniencia
export const clinicRepository = clinicaRepository
