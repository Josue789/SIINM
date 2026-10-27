import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  PackagePlus,
  Package,
  Download,
  Settings,
  BookOpen,
  Building2,
  LogOut,
  CheckCircle2,
  Menu,
  X,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import { ROUTES } from "../router/routes";
import { NetworkStatusBadge } from "../components/common/NetworkStatusBadge";

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { isOnline, isSyncing, triggerSync } = useNetwork();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const medicineControlItems = [
    {
      to: ROUTES.PRESCRIPTIONS,
      label: "Surtir receta",
      icon: ClipboardList,
      isAdminOnly: false,
    },
    {
      to: ROUTES.SUPPLY_ENTRY,
      label: "Entrada de insumos",
      icon: PackagePlus,
      isAdminOnly: false,
    },
    {
      to: ROUTES.INVENTORY,
      label: "Inventario de insumos",
      icon: Package,
      isAdminOnly: false,
    },
  ];

  const toolItems = [
    {
      to: ROUTES.EXPORT,
      label: "Exportar inventario",
      icon: Download,
      isAdminOnly: false,
    },
    {
      to: ROUTES.SETTINGS,
      label: "Administración",
      icon: Settings,
      isAdminOnly: true,
    },
    {
      to: ROUTES.MASTER_CATALOG,
      label: "Catálogo maestro",
      icon: BookOpen,
      isAdminOnly: false,
    },
    {
      to: ROUTES.CLINIC_SUPERVISION,
      label: "Supervisión de clínicas",
      icon: Building2,
      isAdminOnly: true,
    },
  ];

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex max-h-screen items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
      isActive
        ? "bg-white text-blue-600 shadow-sm border border-slate-200/80 font-bold"
        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
    }`;

  return (
    <div className="min-h-screen max-h-screen bg-[#f0f4f9] text-slate-800 flex flex-col md:flex-row antialiased">
      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#eef3f9] border-b border-slate-200">
        <div>
          <span className="text-lg font-black text-slate-800 tracking-wider">
            SIINM
          </span>
          <span className="text-[10px] text-slate-500 block -mt-1 font-medium">
            Sistema de Inventario de Insumos Médicos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NetworkStatusBadge />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-[#eef3f9] border-r border-slate-200 flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header Brand */}
          <div className="text-center pt-2 pb-6 border-b border-slate-200/70">
            <h1 className="text-2xl font-black text-slate-800 tracking-wider m-0">
              SIINM
            </h1>
            <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
              Sistema de Inventario de Insumos Médicos
            </p>
          </div>

          {/* Navigation Items */}
          <div className="mt-5 space-y-6 flex-1">
            {/* Sección: Control de medicamentos */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase px-3 mb-2">
                Control de medicamentos
              </p>
              <nav className="space-y-1">
                {medicineControlItems.map((item) => {
                  const Icon = item.icon;
                  if (item.isAdminOnly && user?.role !== "admin") {
                    return null;
                  } else {
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={getNavLinkClass}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  }
                })}
              </nav>
            </div>

            {/* Sección: Herramientas */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase px-3 mb-2">
                Herramientas
              </p>
              <nav className="space-y-1">
                {toolItems.map((item) => {
                  const Icon = item.icon;
                  if (item.isAdminOnly && user?.role !== "admin") {
                    return null;
                  } else {
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={getNavLinkClass}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  }
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Footer Sidebar: Otras opciones & User Card */}
        <div className="pt-4 border-t border-slate-200/80 mt-auto flex flex-col gap-3">
          <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase px-3 m-0">
            Otras opciones
          </p>

          {/* Sincronización Status Button/Pill */}
          <button
            onClick={() => triggerSync()}
            title={
              isOnline
                ? "Hacer clic para sincronizar con el servidor"
                : "Sin conexión a internet"
            }
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              {isSyncing
                ? "Sincronizando..."
                : isOnline
                  ? "Aplicación sincronizada"
                  : "Modo fuera de línea"}
            </span>
          </button>

          {/* User Profile Card & Red Logout Button */}
          <div className="flex items-center gap-2 p-2 bg-white/70 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 shrink-0 overflow-hidden font-bold text-xs">
              {user?.fullName ? (
                user.fullName.substring(0, 2).toUpperCase()
              ) : (
                <UserIcon className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate m-0 leading-tight">
                {user?.fullName || user?.email || "Usuario"}
              </p>
              <p className="text-[10px] text-slate-500 font-medium truncate m-0 leading-tight uppercase">
                {user?.role || "Farmacéutico"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="w-8 h-8 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/30 z-30 md:hidden backdrop-blur-2xs"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
