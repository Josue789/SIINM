import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  LogIn,
  Key,
  Mail,
  Eye,
  EyeOff,
  WifiOff,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import { useNetwork } from "../../context/NetworkContext";
import {
  OFFLINE_AUTH_TTL_DAYS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  getLoginLockoutStatus,
  formatLockoutDuration,
} from "../../services/supabase/auth.service";
import { ROUTES } from "../../router/routes";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

interface FormValues {
  email: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const {
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const watchedEmail = watch("email") || "";
  const [lockoutState, setLockoutState] = useState(() =>
    getLoginLockoutStatus(),
  );

  const { login } = useAuth();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();
  const location = useLocation();

  // Actualizar estado de bloqueo cuando cambia el correo o cada segundo mientras esté bloqueado
  useEffect(() => {
    setLockoutState(getLoginLockoutStatus(watchedEmail));
  }, [watchedEmail]);

  useEffect(() => {
    if (!lockoutState.isLocked) return;
    const timer = setInterval(() => {
      const next = getLoginLockoutStatus(watchedEmail);
      setLockoutState(next);
      if (!next.isLocked) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutState.isLocked, watchedEmail]);

  // Ruta a la que intentaba acceder antes de ser redirigido
  const destination =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    ROUTES.MASTER_CATALOG;

  const onSubmit = async (credentials: FormValues) => {
    const currentLock = getLoginLockoutStatus(credentials.email);
    setLockoutState(currentLock);

    if (currentLock.isLocked) {
      return toast.error(
        `Cuenta bloqueada temporalmente. Intenta de nuevo en ${formatLockoutDuration(currentLock.remainingSeconds)}.`,
      );
    }

    setIsSubmitting(true);

    const result = await login(credentials.email, credentials.password);
    setIsSubmitting(false);

    const updatedLock = getLoginLockoutStatus(credentials.email);
    setLockoutState(updatedLock);

    if (result.success) {
      reset();
      if (credentials.password.trim().startsWith("Siinm-")) {
        toast.info(
          "Ingresaste con una clave temporal. Por seguridad, establece tu nueva contraseña.",
        );
        navigate(
          `${ROUTES.RESET_PASSWORD}?email=${encodeURIComponent(credentials.email.trim())}`,
          { replace: true },
        );
        return;
      }
      if (!isOnline) {
        toast.info("Sesión iniciada en modo sin conexión (Offline).");
      }
      navigate(destination, { replace: true });
    } else if (result.error?.includes("rate limit")) {
      toast.error("Demasiados intentos fallidos, inténtalo más tarde");
    } else {
      toast.error(result.error || "Las credenciales son incorrectas");
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-1">
          Iniciar Sesión
        </h2>
        <p className="text-xs text-slate-500">Ingresa con tus credenciales</p>
      </div>

      {lockoutState.isLocked && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-snug">
            <p className="font-bold m-0">
              Acceso bloqueado temporalmente ({MAX_FAILED_LOGIN_ATTEMPTS}/
              {MAX_FAILED_LOGIN_ATTEMPTS} intentos fallidos)
            </p>
            <p className="text-red-700 mt-0.5 m-0">
              Por seguridad, debes esperar{" "}
              <strong className="font-mono">
                {formatLockoutDuration(lockoutState.remainingSeconds)}
              </strong>{" "}
              antes de volver a intentarlo.
            </p>
          </div>
        </div>
      )}

      {!lockoutState.isLocked && lockoutState.attempts > 0 && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
          <span>Intentos fallidos registrados:</span>
          <strong className="font-mono">
            {lockoutState.attempts} / {MAX_FAILED_LOGIN_ATTEMPTS}
          </strong>
        </div>
      )}

      {!isOnline && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800">
          <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-snug">
            <p className="font-bold m-0">Modo sin conexión detectado</p>
            <p className="text-amber-700 mt-0.5 m-0">
              Puedes ingresar si ya habías iniciado sesión en línea en este dispositivo durante los últimos {OFFLINE_AUTH_TTL_DAYS} días.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Field>
            <FieldLabel htmlFor="input-group-email">
              Correo Electrónico
            </FieldLabel>
            <InputGroup className={errors.email ? "border-red-500" : ""}>
              <InputGroupInput
                id="input-group-email"
                type="email"
                className="pl-9"
                placeholder="usuario@ejemplo.com"
                {...register("email", {
                  required: "El correo es obligatorio",
                })}
              />
              <InputGroupAddon>
                <Mail className={errors.email ? "text-red-500" : ""} />
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <span className="text-red-700 text-xs font-semibold m-1">
            {errors.email?.message?.toString()}
          </span>
        </div>

        <div>
          <Field>
            <FieldLabel htmlFor="input-group-password">Contraseña</FieldLabel>
            <InputGroup className={errors.email ? "border-red-500" : ""}>
              <InputGroupInput
                id="input-group-password"
                type={isVisible ? "text" : "password"}
                className="pl-9"
                placeholder="Ingresa tu contraseña"
                {...register("password", {
                  required: "La contraseña es obligatoria",
                })}
              />
              <InputGroupAddon>
                <Key className={errors.email ? "text-red-500" : ""} />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVisible(!isVisible)}
                >
                  {isVisible ? <EyeOff /> : <Eye />}
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <span className="text-red-700 text-xs font-semibold m-1">
            {errors.password?.message?.toString()}
          </span>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || lockoutState.isLocked}
          className="w-full mt-2 h-11"
        >
          {isSubmitting ? (
            <span>Conectando...</span>
          ) : lockoutState.isLocked ? (
            <span>
              Bloqueado ({formatLockoutDuration(lockoutState.remainingSeconds)})
            </span>
          ) : (
            <>
              <LogIn className="w-4 h-4 mr-2" />
              <span>Entrar al Sistema</span>
            </>
          )}
        </Button>

        <div className="pt-2 text-center">
          <Link
            to={ROUTES.RESET_PASSWORD}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>¿Recibiste una clave temporal? Cambiar contraseña</span>
          </Link>
        </div>
      </form>
    </div>
  );
};
