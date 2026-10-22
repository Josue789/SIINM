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
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
      <Card className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 shadow-md">
        <div>
          <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 text-xs font-medium mb-3 gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Arquitectura Offline-First Activa</span>
          </Badge>
          <h1 className="text-2xl font-black text-white mb-1.5">
            ¡Hola, {user?.fullName || 'Farmacéutico'}!
          </h1>
          <p className="text-xs md:text-sm text-blue-100 max-w-xl">
            Bienvenido al panel de control de SIINM. Tus datos se guardan de forma local en tu
            dispositivo (IndexedDB con Dexie) y se sincronizan automáticamente con la nube cuando hay conexión.
          </p>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Medicamentos Locales */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Medicamentos en BD Local
              </span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-800">{medicineCount}</div>
            <p className="text-xs text-slate-500 mt-1">Disponibles con o sin internet</p>
          </div>
          <Link
            to={ROUTES.INVENTORY}
            className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            <span>Ver Inventario</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        {/* Card 2: Cola de Sincronización */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Cola de Salida (Outbox)
              </span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-800">{pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              {pendingCount === 0
                ? 'Todos los datos están al día'
                : 'Cambios locales pendientes de subida'}
            </p>
          </div>
          <Link
            to={ROUTES.SYNC}
            className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-600 hover:text-amber-700"
          >
            <span>Examinar cola de cambios</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        {/* Card 3: Estado de Conectividad */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Estado de Red
              </span>
              <div
                className={`p-2.5 rounded-xl ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
            </div>
            <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? 'bg-emerald-500' : 'bg-rose-500'
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => triggerSync()}
            disabled={!isOnline || isSyncing}
            className="mt-4 pt-3 border-t border-slate-100 w-full justify-between h-auto p-0 pt-3 text-slate-600 hover:text-slate-900 hover:bg-transparent"
          >
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
            <HardDriveDownload className="w-3.5 h-3.5" />
          </Button>
        </Card>
      </div>

      {/* Feature highlights */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-3">
          ¿Cómo funciona el Offline-First en este proyecto?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              1. Lectura / Escritura Local
            </div>
            La UI nunca espera la respuesta del servidor. Las altas, bajas y cambios van directo a Dexie (IndexedDB).
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              2. Outbox Queue
            </div>
            Cada mutación genera un ítem en la tabla `sync_queue` con el payload y la acción correspondiente.
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              3. Sync Engine con Supabase
            </div>
            El motor detecta el evento `online` y vacía la cola hacia Supabase, trayendo además los cambios remotos.
          </div>
        </div>
      </Card>
    </div>
  )
}
