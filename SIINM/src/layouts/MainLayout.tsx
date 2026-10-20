import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  RefreshCw,
  LogOut,
  Pill,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '../router/routes'
import { NetworkStatusBadge } from '../components/common/NetworkStatusBadge'

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const navItems = [
    { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.INVENTORY, label: 'Inventario', icon: Package },
    { to: ROUTES.SYNC, label: 'Sincronización', icon: RefreshCw },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shrink-0">
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <Pill className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide m-0">SIINM</h2>
            <span className="text-[10px] text-emerald-400 font-medium">OFFLINE-FIRST</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/40">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate m-0">
                {user?.fullName || user?.email || 'Usuario'}
              </p>
              <p className="text-[11px] text-slate-400 truncate m-0 capitalize">
                {user?.role || 'Farmacéutico'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-sm font-semibold text-slate-300 hidden md:block m-0">
            Sistema de Inventario de Medicamentos
          </h3>
          <div className="flex items-center gap-4 ml-auto">
            <NetworkStatusBadge />
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
