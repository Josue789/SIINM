import React from 'react'
import { Users, Hospital, Pill, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

export const SettingsPage: React.FC = () => {
  const settingsOptions = [
    {
      id: 'users',
      title: 'Configurar usuarios',
      desc: 'Administrar permisos, roles y accesos del personal',
      icon: Users,
    },
    {
      id: 'units',
      title: 'Configurar unidades',
      desc: 'Gestionar clínicas, almacenes y áreas de farmacia',
      icon: Hospital,
    },
    {
      id: 'medicines-catalog',
      title: 'Administrar catálogo de medicamentos',
      desc: 'Claves SSA, presentaciones y cuadros básicos',
      icon: Pill,
    },
  ]

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Configuración
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Parámetros generales de la plataforma y administración de recursos
        </p>
      </div>

      <div className="space-y-3">
        {settingsOptions.map((opt) => {
          const Icon = opt.icon
          return (
            <Card
              key={opt.id}
              className="p-4 hover:bg-slate-50/80 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 m-0 group-hover:text-blue-600 transition-colors">
                    {opt.title}
                  </h3>
                  <span className="text-[11px] text-slate-400">{opt.desc}</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </Card>
          )
        })}
      </div>
    </div>
  )
}
