import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { User, AuthSession, AuthState } from '../types/auth.types'
import { authService } from '../services/supabase/auth.service'

interface AuthContextType extends AuthState {
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const LOCAL_STORAGE_KEY = 'siinm_cached_session'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 1. Cargar sesión cached inmediatamente para soporte Offline-First instantáneo
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as AuthSession
        setUser(cached.user)
        setSession(cached)
      }
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
    }

    // 2. Si hay conexión, intentar verificar con Supabase en background
    authService.getCurrentSession().then((liveSession) => {
      if (liveSession) {
        setUser(liveSession.user)
        setSession(liveSession)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(liveSession))
      }
      setIsLoading(false)
    }).catch(() => {
      setIsLoading(false)
    })
  }, [])

  const login = async (email: string, password = 'password123') => {
    setIsLoading(true)
    try {
      // Intento con Supabase
      const result = await authService.signInWithPassword(email, password)

      if (result.user) {
        const newSession: AuthSession = {
          user: result.user,
          token: 'supabase-token',
        }
        setUser(result.user)
        setSession(newSession)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSession))
        setIsLoading(false)
        return { success: true }
      }

      // Si falla o estamos offline/demo, permitimos login local offline de prueba
      const fallbackUser: User = {
        id: 'local-' + Date.now(),
        email,
        fullName: email.split('@')[0].toUpperCase(),
        role: 'pharmacist',
      }
      const localSession: AuthSession = {
        user: fallbackUser,
        token: 'local-offline-token',
      }
      setUser(fallbackUser)
      setSession(localSession)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localSession))
      setIsLoading(false)
      return { success: true }
    } catch (err: unknown) {
      setIsLoading(false)
      const msg = err instanceof Error ? err.message : 'Error al autenticar'
      return { success: false, error: msg }
    }
  }

  const logout = async () => {
    setIsLoading(true)
    await authService.signOut()
    setUser(null)
    setSession(null)
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    setIsLoading(false)
  }

  const value = useMemo(
    () => ({
      user,
      session,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }),
    [user, session, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
