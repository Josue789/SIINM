import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  RefreshCw,
  Database,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HardDriveDownload,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNetwork } from '../../context/NetworkContext'
import { db } from '../../db'
import { ROUTES } from '../../router/routes'

export const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const { isOnline, pendingCount, triggerSync, isSyncing, lastSyncAt } = useNetwork()
  const [medicineCount, setMedicineCount] = useState(0)

  useEffect(() => {
    db.medicines.count().then(setMedicineCount).catch(() => {})
  }, [])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero Welcome */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Arquitectura Offline-First Activa</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            ¡Hola, {user?.fullName || 'Farmacéutico'}!
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Bienvenido al panel principal de SIINM. Tus datos se guardan primero en tu
            dispositivo (IndexedDB con Dexie) y se sincronizan en segundo plano con Supabase.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Medicamentos Locales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Medicamentos en BD Local
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{medicineCount}</div>
            <p className="text-xs text-slate-500 mt-1">Disponibles con o sin internet</p>
          </div>
          <Link
            to={ROUTES.INVENTORY}
            className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            <span>Ver Inventario</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 2: Cola de Sincronización */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cola de Salida (Outbox)
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              {pendingCount === 0
                ? 'Todos los datos están al día con Supabase'
                : 'Cambios locales pendientes de subida'}
            </p>
          </div>
          <Link
            to={ROUTES.SYNC}
            className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-amber-400 hover:text-amber-300"
          >
            <span>Examinar cola de cambios</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 3: Estado de Conectividad */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Estado de Red
            </span>
            <div
              className={`p-2 rounded-xl border ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <span>{isOnline ? 'Conectado a Internet' : 'Sin Conexión'}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {lastSyncAt
                ? `Última sincronización: ${new Date(lastSyncAt).toLocaleTimeString()}`
                : 'Aún no se ha realizado sincronización'}
            </p>
          </div>
          <button
            onClick={() => triggerSync()}
            disabled={!isOnline || isSyncing}
            className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40"
          >
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
            <HardDriveDownload className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3">
          ¿Cómo funciona el Offline-First en este proyecto?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              1. Lectura / Escritura Local
            </div>
            La UI nunca espera la respuesta del servidor. Las altas, bajas y cambios van directo a Dexie (IndexedDB).
          </div>
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              2. Outbox Queue
            </div>
            Cada mutación genera un ítem en la tabla `sync_queue` con el payload y la acción correspondiente.
          </div>
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              3. Sync Engine con Supabase
            </div>
            El motor detecta el evento `online` y vacía la cola hacia Supabase, trayendo además los cambios remotos.
          </div>
        </div>
      </div>
    </div>
  )
}
