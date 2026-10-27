import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LogIn,
  Key,
  Mail,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../router/routes";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field, FieldLabel } from "@/components/ui/field";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Ruta a la que intentaba acceder antes de ser redirigido
  const destination =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    ROUTES.MASTER_CATALOG;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate(destination, { replace: true });
    } else {
      setError(result.error || "Credenciales incorrectas");
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

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Field>
            <FieldLabel htmlFor="input-group-email">
              Correo Electrónico
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="input-group-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
                placeholder="usuario@ejemplo.com"
              />
              <InputGroupAddon>
                <Mail />
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>

        <div>
          <Field>
            <FieldLabel htmlFor="input-group-password">Contraseña</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="input-group-password"
                type={isVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-9"
                placeholder="Ingresa tu contraseña"
              />
              <InputGroupAddon>
                <Key />
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
