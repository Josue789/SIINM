import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import type { User, AuthSession, AuthState } from "../types/auth.types";
import {
  authService,
  syncOfflineRecordProfile,
  revokeOfflineAuthRecord,
} from "../services/supabase/auth.service";
import { supabase } from "../services/supabase/client";
import { networkWatcher } from "../sync/networkWatcher";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

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
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(() =>
    typeof window !== "undefined" &&
    window.location.hash.includes("type=recovery"),
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

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
    } = supabase.auth.onAuthStateChange((event, sbSession) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryOpen(true);
      }
      if (!sbSession) {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          setIsLoading(false);
          return;
        }
        // Si no hay sesión de Supabase (ej. inicio offline), verificar si existe sesión offline válida
        authService
          .getValidActiveOfflineSession()
          .then((offlineSess) => {
            if (!isMounted) return;
            if (offlineSess) {
              setUser(offlineSess.user);
              setSession(offlineSess);
            } else {
              setUser(null);
              setSession(null);
            }
            setIsLoading(false);
          })
          .catch(() => {
            if (!isMounted) return;
            setUser(null);
            setSession(null);
            setIsLoading(false);
          });
        return;
      }

      // Ejecutar fuera del lock síncrono de GoTrueClient para evitar bloqueo en getSession()
      setTimeout(async () => {
        if (!isMounted) return;
        const profile = await authService.getUserProfile(
          sbSession.user.id,
          sbSession.user.email,
          sbSession.user.user_metadata,
        );
        if (!isMounted) return;

        const u = authService.buildUser(sbSession.user, profile);
        if (u.activo === false) {
          revokeOfflineAuthRecord(u.email);
          await authService.signOut();
          if (!isMounted) return;
          setUser(null);
          setSession(null);
          setIsLoading(false);
          toast.error(
            "Esta cuenta se encuentra desactivada. Contacta al administrador.",
          );
          return;
        }

        if (typeof navigator !== "undefined" && navigator.onLine) {
          await syncOfflineRecordProfile(u, true);
        }

        setUser(u);
        setSession({
          user: u,
          token: sbSession.access_token,
          expiresAt: sbSession.expires_at,
        });
        setIsLoading(false);
      }, 0);
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
    const { data } = await supabase.auth.getSession();
    const sbUser = data.session?.user;
    const targetId = sbUser?.id || user?.id;
    const targetEmail = sbUser?.email || user?.email;

    if (!targetId) return;

    const profile = await authService.getUserProfile(
      targetId,
      targetEmail,
      sbUser?.user_metadata,
    );
    if (profile) {
      const base = sbUser || user || { id: targetId, email: targetEmail || "" };
      const updatedUser = authService.buildUser(base, profile);

      if (updatedUser.activo === false) {
        revokeOfflineAuthRecord(updatedUser.email);
        await authService.signOut();
        setUser(null);
        setSession(null);
        toast.error(
          "Tu cuenta ha sido desactivada. Se ha cerrado la sesión.",
        );
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        await syncOfflineRecordProfile(updatedUser, true);
      }

      setUser((prev) => {
        if (
          prev &&
          prev.id === updatedUser.id &&
          prev.email === updatedUser.email &&
          prev.fullName === updatedUser.fullName &&
          prev.role === updatedUser.role &&
          prev.clinicaId === updatedUser.clinicaId &&
          prev.clinicaNombre === updatedUser.clinicaNombre
        ) {
          return prev;
        }
        return updatedUser;
      });
      setSession((prev) => {
        if (!prev) return null;
        return { ...prev, user: updatedUser };
      });
    }
  }, [user]);

  // Al recuperar la conexión a Internet, revalidar accesos y datos del usuario en segundo plano
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = networkWatcher.subscribe((online) => {
      if (online) {
        refreshProfile().catch(console.error);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [user?.id, refreshProfile]);

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

  const handlePasswordRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await authService.updateOwnPassword(newPassword.trim());
    setIsUpdatingPassword(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Contraseña actualizada exitosamente");
    setIsRecoveryOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Dialog open={isRecoveryOpen} onOpenChange={setIsRecoveryOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handlePasswordRecoverySubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Establecer Nueva Contraseña</DialogTitle>
              <DialogDescription>
                Ingresa tu nueva contraseña (o la clave temporal proporcionada)
                para actualizar tu cuenta en Supabase.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nueva Contraseña * (mínimo 8 caracteres)
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirmar Contraseña *
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecoveryOpen(false)}
                disabled={isUpdatingPassword}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdatingPassword}>
                {isUpdatingPassword ? "Actualizando..." : "Guardar Contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
