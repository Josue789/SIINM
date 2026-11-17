import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogIn, Key, Mail, Eye, EyeOff, WifiOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import { useNetwork } from "../../context/NetworkContext";
import { OFFLINE_AUTH_TTL_DAYS } from "../../services/supabase/auth.service";
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
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [tries, setTries] = useState(0);

  const { login } = useAuth();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();
  const location = useLocation();

  // Ruta a la que intentaba acceder antes de ser redirigido
  const destination =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    ROUTES.MASTER_CATALOG;

  const onSubmit = async (credentials: FormValues) => {
    if (tries >= 5) {
      return toast.error("Demasiado intentos fallidos, intentalo mas tarde");
    }
    setIsSubmitting(true);

    const result = await login(credentials.email, credentials.password);
    setIsSubmitting(false);

    if (result.success) {
      reset();
      setTries(0);
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
    } else if (
      result.error?.includes("desactivada") ||
      result.error?.includes("primer inicio de sesión") ||
      result.error?.includes("expiró") ||
      result.error?.includes("alterados")
    ) {
      toast.error(result.error);
    } else if (result.error?.includes("rate limit")) {
      toast.error("Demasiados intentos fallidos, intentalo mas tarde");
    } else {
      setTries((prev) => prev + 1);
      toast.error("Las credenciales son incorrectas");
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
          disabled={isSubmitting}
          className="w-full mt-2 h-11"
        >
          {isSubmitting ? (
            <span>Conectando...</span>
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
