import React from 'react'
import { Outlet } from 'react-router-dom'
import { Pill } from 'lucide-react'

import { Card } from '@/components/ui/card'

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-blue-50 border border-blue-200/80 rounded-2xl mb-3 shadow-xs">
            <Pill className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-black tracking-wider text-slate-800 m-0">SIMI</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">CASSIS - Control de Medicamentos</p>
        </div>
        <Card className="p-6 md:p-8 shadow-sm">
          <Outlet />
        </Card>
      </div>
    </div>
  )
}
