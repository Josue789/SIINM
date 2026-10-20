export interface User {
  id: string
  email: string
  fullName?: string
  role?: 'admin' | 'pharmacist' | 'operator'
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
