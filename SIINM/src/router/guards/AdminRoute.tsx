import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../routes";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

/**
 * Guard que protege rutas privadas.
 * Si el usuario no ha iniciado sesión, lo redirige a /login
 * guardando la URL intentada en el estado para volver a ella tras autenticarse.
 */
export const AdminRoute: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner message="Verificando sesión..." />;
  }

  if (!isAuthenticated) {
    // Redirección a login preservando la ruta de origen
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (user?.role !== "admin") {
    // Redirección a catalogos para evitar bucles infinitos
    return (
      <Navigate to={ROUTES.SUPPLY_ENTRY} state={{ from: location }} replace />
    );
  }

  return <Outlet />;
};
