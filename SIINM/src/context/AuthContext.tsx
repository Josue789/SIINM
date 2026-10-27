import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import type { User, AuthSession, AuthState } from "../types/auth.types";
import { authService } from "../services/supabase/auth.service";
import { supabase } from "../services/supabase/client";

interface AuthContextType extends AuthState {
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    needsEmailConfirmation?: boolean;
  }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. Obtener la sesión real actual guardada por el cliente de Supabase
    authService
      .getCurrentSession()
      .then((currentSession) => {
        if (!isMounted) return;
        if (currentSession) {
          setUser(currentSession.user);
          setSession(currentSession);
        } else {
          setUser(null);
          setSession(null);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    // 2. Suscribirse a los cambios de autenticación de Supabase en tiempo real
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, sbSession) => {
      if (!isMounted) return;
      if (sbSession) {
        // Obtenemos el perfil directamente de la tabla Perfil_usuarios
        const profile = await authService.getUserProfile(sbSession.user.id);
        if (!isMounted) return;

        const u = authService.buildUser(sbSession.user, profile);
        setUser(u);
        setSession({
          user: u,
          token: sbSession.access_token,
          expiresAt: sbSession.expires_at,
        });
      } else {
        setUser(null);
        setSession(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Inicia sesión con credenciales reales en Supabase Auth.
   * Sin tokens falsos ni fallbacks simulados.
   */
  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const result = await authService.signInWithPassword(email, password);

      if (result.error || !result.user || !result.session) {
        setIsLoading(false);
        return {
          success: false,
          error:
            result.error?.message ||
            "Error al iniciar sesión. Verifica tu correo y contraseña.",
        };
      }

      setUser(result.user);
      setSession(result.session);
      setIsLoading(false);
      return { success: true };
    } catch (err: unknown) {
      setIsLoading(false);
      const msg =
        err instanceof Error
          ? err.message
          : "Error inesperado al conectar con Supabase";
      return { success: false, error: msg };
    }
  };

  /**
   * Registra un nuevo usuario en Supabase Auth.
   */
  const register = async (
    email: string,
    password: string,
    fullName?: string,
  ): Promise<{
    success: boolean;
    error?: string;
    needsEmailConfirmation?: boolean;
  }> => {
    setIsLoading(true);
    try {
      const result = await authService.signUp(email, password, fullName);

      if (result.error || !result.user) {
        setIsLoading(false);
        return {
          success: false,
          error:
            result.error?.message || "No se pudo crear la cuenta en Supabase",
        };
      }

      if (result.session) {
        setUser(result.user);
        setSession(result.session);
      }

      setIsLoading(false);
      return {
        success: true,
        needsEmailConfirmation: result.needsEmailConfirmation,
      };
    } catch (err: unknown) {
      setIsLoading(false);
      const msg =
        err instanceof Error ? err.message : "Error al registrar usuario";
      return { success: false, error: msg };
    }
  };

  /**
   * Cierra la sesión activa en Supabase.
   */
  const logout = async () => {
    setIsLoading(true);
    await authService.signOut();
    setUser(null);
    setSession(null);
    setIsLoading(false);
  };

  /**
   * Recarga el perfil del usuario autenticado desde la tabla Perfil_usuarios.
   */
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profile = await authService.getUserProfile(user.id);
    if (profile) {
      const updatedUser = authService.buildUser(user, profile);
      setUser(updatedUser);
      setSession((prev) => (prev ? { ...prev, user: updatedUser } : null));
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      session,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, session, isLoading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
