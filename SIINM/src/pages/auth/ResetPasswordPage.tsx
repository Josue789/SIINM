import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { useAuth } from "@/context/AuthContext";
import {
  authService,
  computeTempPasswordHash,
  getLocalTempPasswordHash,
  clearLocalTempPasswordHash,
} from "@/services/supabase/auth.service";
import { supabase } from "@/services/supabase/client";
import { ROUTES } from "@/router/routes";
import { toast } from "react-toastify";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout, refreshProfile } = useAuth();

  const urlEmail = searchParams.get("email") || "";
  const urlVerificationHash = searchParams.get("v") || "";

  const [email, setEmail] = useState(urlEmail || user?.email || "");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showTemp, setShowTemp] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  // Detectar sesión activa o sesión proveniente del enlace de correo de Supabase
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        setHasRecoverySession(true);
        if (data.session.user.email) {
          setEmail(data.session.user.email);
        }
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        session?.user
      ) {
        if (session?.user) {
          setHasRecoverySession(true);
          if (session.user.email) {
            setEmail(session.user.email);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const expectedHash =
    urlVerificationHash || getLocalTempPasswordHash(email) || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim();
    const cleanTemp = tempPassword.trim();
    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanEmail) {
      toast.error("Ingresa tu correo electrónico institucional.");
      return;
    }

    if (!cleanTemp) {
      toast.error(
        "Ingresa la clave temporal proporcionada por el administrador.",
      );
      return;
    }

    if (cleanNew.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (cleanNew !== cleanConfirm) {
      toast.error("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    if (cleanNew === cleanTemp) {
      toast.error(
        "Tu nueva contraseña debe ser distinta a la clave temporal.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Si no tiene sesión activa todavía (entró directo desde la app de escritorio Tauri),
      // autenticarlo contra Supabase usando la Clave Temporal (o código OTP de 6 dígitos si se envió por correo)
      if (!hasRecoverySession) {
        const isSixDigitOtp = /^\d{6}$/.test(cleanTemp);

        if (isSixDigitOtp) {
          const { data: otpData, error: otpError } =
            await supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanTemp,
              type: "recovery",
            });

          if (otpError || !otpData.session) {
            setIsSubmitting(false);
            toast.error(
              "El código de verificación de 6 dígitos es inválido o ha expirado.",
            );
            return;
          }
        } else {
          if (expectedHash) {
            const candidateHash = await computeTempPasswordHash(
              cleanEmail,
              cleanTemp,
            );
            if (candidateHash !== expectedHash) {
              setIsSubmitting(false);
              toast.error(
                "La clave temporal ingresada no coincide con la asignada por el administrador.",
              );
              return;
            }
          }

          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanTemp,
            });

          if (signInError || !signInData.session) {
            setIsSubmitting(false);
            toast.error(
              "La clave temporal es incorrecta o aún no ha sido aplicada en Supabase.",
            );
            return;
          }
        }
      } else if (expectedHash) {
        // Si ya tenía sesión iniciada con la clave temporal, verificar que confirme su clave temporal
        const candidateHash = await computeTempPasswordHash(
          cleanEmail,
          cleanTemp,
        );
        if (candidateHash !== expectedHash) {
          setIsSubmitting(false);
          toast.error(
            "La clave temporal ingresada no coincide con la asignada por el administrador.",
          );
          return;
        }
      }

      // 3. Actualizar la contraseña definitiva en Supabase Auth y limpiar bloqueo temporal
      const { error } = await authService.updateOwnPassword(cleanNew);
      if (error) {
        setIsSubmitting(false);
        toast.error(error.message);
        return;
      }

      clearLocalTempPasswordHash(cleanEmail);
      await refreshProfile();
      toast.success("¡Contraseña actualizada exitosamente! Ya puedes acceder al sistema.");
      navigate(ROUTES.MASTER_CATALOG, { replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error inesperado al restablecer la contraseña";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          Restablecer Contraseña
        </h2>
        <p className="text-xs text-slate-500">
          Ingresa la clave temporal asignada por el administrador y define tu
          nueva contraseña personal
        </p>
      </div>

      {user?.mustChangePassword ? (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold m-0">Cambio de contraseña obligatorio</p>
            <p className="text-amber-700 mt-0.5 m-0">
              Ingresaste con una clave temporal. Por seguridad, debes definir tu
              nueva contraseña personal antes de acceder a la aplicación.
            </p>
          </div>
        </div>
      ) : (
        hasRecoverySession && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Enlace de recuperación verificado para{" "}
              <strong className="break-all">{email}</strong>
            </span>
          </div>
        )
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Field>
          <FieldLabel htmlFor="reset-email">Correo Electrónico</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={hasRecoverySession && !!email}
              placeholder="usuario@ejemplo.com"
              className="pl-9 text-xs"
              required
            />
            <InputGroupAddon>
              <Mail className="w-4 h-4 text-slate-400" />
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel htmlFor="reset-temp-password">
            Clave Temporal de Seguridad *
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="reset-temp-password"
              type={showTemp ? "text" : "password"}
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Ej. Siinm-XXXX..."
              className="pl-9 font-mono text-xs"
              required
            />
            <InputGroupAddon>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTemp(!showTemp)}
              >
                {showTemp ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Proporcionada por el administrador del sistema para autorizar el
            cambio.
          </span>
        </Field>

        <Field>
          <FieldLabel htmlFor="reset-new-password">
            Nueva Contraseña * (mín. 8 caracteres)
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="reset-new-password"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ingresa tu nueva contraseña"
              className="pl-9 text-xs"
              minLength={8}
              required
            />
            <InputGroupAddon>
              <Lock className="w-4 h-4 text-slate-400" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel htmlFor="reset-confirm-password">
            Confirmar Nueva Contraseña *
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="reset-confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu nueva contraseña"
              className="pl-9 text-xs"
              minLength={8}
              required
            />
            <InputGroupAddon>
              <Lock className="w-4 h-4 text-slate-400" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 h-11 gap-2"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="w-4 h-4 animate-spin" />
              <span>Actualizando Contraseña...</span>
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              <span>Guardar Nueva Contraseña</span>
            </>
          )}
        </Button>

        <div className="pt-2 text-center">
          {user || hasRecoverySession ? (
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate(ROUTES.LOGIN, { replace: true });
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cerrar sesión y volver al inicio</span>
            </button>
          ) : (
            <Link
              to={ROUTES.LOGIN}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Iniciar Sesión</span>
            </Link>
          )}
        </div>
      </form>
    </div>
  );
};

