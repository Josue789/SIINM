import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogIn, Key, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../router/routes";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

export const LoginPage: React.FC = () => {
  interface formValues {
    email: string;
    password: string;
  }
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [tries, setTries] = useState(0);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Ruta a la que intentaba acceder antes de ser redirigido
  const destination =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    ROUTES.MASTER_CATALOG;

  const onSubmit = async (credentials: formValues) => {
    if (tries >= 5) {
      return toast.error("Demasiado intentos fallidos, intentalo mas tarde");
    }
    setIsSubmitting(true);

    const result = await login(credentials.email, credentials.password);
    setIsSubmitting(false);

    if (result.success) {
      reset();
      setTries(0);
      navigate(destination, { replace: true });
    } else if (result.error?.includes("desactivada")) {
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
            {errors.email?.message.toString()}
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
            {errors.password?.message.toString()}
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
      </form>
    </div>
  );
};
