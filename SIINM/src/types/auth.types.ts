export type UserRole = 'Personal' | 'encargado' | 'admin'

export interface User {
  id: string
  email: string
  fullName?: string
  role?: UserRole
  clinicaId?: number | null
  clinicaNombre?: string
  activo?: boolean
}

export interface PerfilUsuario {
  id: string
  email: string
  nombre: string
  rol: UserRole
  clinica_id?: number | null
  activo?: boolean
  created_at?: string
  clinica?: {
    id: number
    nombre: string
  }
}

export interface AuthSession {
  user: User
  token: string
  expiresAt?: number
}

export interface AuthState {
  user: User | null
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
}
