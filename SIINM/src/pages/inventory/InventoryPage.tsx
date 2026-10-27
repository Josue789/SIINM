import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, AlertTriangle, Trash2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { useNetwork } from "@/context/NetworkContext";
import { useAuth } from "@/context/AuthContext";
import { inventarioRepository } from "@/db/repositories/inventario.repository";
import { ROUTES } from "@/router/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "react-toastify";

type FilterMode = "todos" | "caducan" | "diez_dias";

export interface DisplayInventoryItem {
  id: string | number;
  clave_ssa: string;
  medicamento: string;
  presentacion: string;
  lote: string;
  fecha_caducidad: string;
  stock: number;
}

// Verifica si la fecha de caducidad está dentro del rango especificado
const isExpiringSoon = (
  expirationDate?: string,
  maxDays = 30,
  currentTimestamp = Date.now(),
) => {
  if (!expirationDate || expirationDate === "N/A") return false;

  let expTime = 0;
  if (expirationDate.includes("/")) {
    const parts = expirationDate.split("/").map(Number);
    if (parts.length === 2) {
      const m = parts[0];
      const y = parts[1] < 100 ? parts[1] + 2000 : parts[1];
      expTime = new Date(y, m, 0).getTime();
    }
  } else {
    expTime = new Date(expirationDate).getTime();
  }

  if (isNaN(expTime)) return false;
  const diffDays = (expTime - currentTimestamp) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
};

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, isSyncing, triggerSync, refreshPendingCount } = useNetwork();
  const [filterMode, setFilterMode] = useState<FilterMode>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTimestamp] = useState(() => Date.now());

  // Función para sincronizar con Supabase manualmente
  const handleSync = async () => {
    try {
      // 1. Sube registros locales que no se hayan subido aún
      await inventarioRepository.pushUnsyncedLocal();
      // 2. Descarga registros remotos para la clínica del usuario
      if (user?.clinicaId) {
        await inventarioRepository.pullFromRemote(user.clinicaId);
      } else {
        await inventarioRepository.pullFromRemote();
      }
      // 3. Sincroniza la cola de cambios pendientes
      await triggerSync(true);
      toast.success("Inventario sincronizado con Supabase");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al sincronizar con Supabase";
      toast.error(msg);
    }
  };

  // Consulta reactiva a Dexie: une inventario local y medicines
  const inventoryItems = useLiveQuery(
    async (): Promise<DisplayInventoryItem[]> => {
      try {
        const localInventario = await db.inventario.toArray();
        if (localInventario && localInventario.length > 0) {
          return localInventario.map((item) => ({
            id:
              item.id ||
              `${item.id_clinica}-${item.id_medicamento}-${item.lote}`,
            clave_ssa: item.clave_ssa || "",
            medicamento: item.medicamento || "Medicamento sin nombre",
            presentacion: item.presentacion || "Pieza",
            lote: item.lote || "00000",
            fecha_caducidad: item.fecha_caducidad || "N/A",
            stock: Number(item.stock) || 0,
          }));
        }

        // Fallback a db.medicines si aún no hay registros en db.inventario
        const legacyMedicines = await db.medicines.toArray();
        return legacyMedicines.map((m) => ({
          id: m.id,
          clave_ssa: m.clave_ssa || m.code || "",
          medicamento: m.medicamento || m.name || "Medicamento",
          presentacion: m.presentacion || m.dosageForm || "Pieza",
          lote: m.batchNumber || "00000",
          fecha_caducidad: m.expirationDate || "N/A",
          stock: Number(m.stock) || 0,
        }));
      } catch (err) {
        console.warn("Error al consultar inventario local:", err);
        return [];
      }
    },
    [],
    [],
  );

  const handleDelete = async (id: string | number) => {
    try {
      await inventarioRepository.delete(id);
      await refreshPendingCount();
      toast.success("Registro eliminado del inventario");
    } catch (err) {
      console.error("Error al eliminar del inventario:", err);
      toast.error("No se pudo eliminar el registro");
    }
  };

  const filteredMedicines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (inventoryItems || []).filter((m) => {
      const medName = (m.medicamento || "").toLowerCase();
      const ssaCode = (m.clave_ssa || "").toLowerCase();
      const batchNum = (m.lote || "").toLowerCase();

      const matchesSearch =
        !query ||
        medName.includes(query) ||
        ssaCode.includes(query) ||
        batchNum.includes(query);

      if (!matchesSearch) return false;

      if (filterMode === "caducan") {
        return isExpiringSoon(m.fecha_caducidad, 30, currentTimestamp);
      }
      if (filterMode === "diez_dias") {
        return isExpiringSoon(m.fecha_caducidad, 10, currentTimestamp);
      }

      return true;
    });
  }, [inventoryItems, searchQuery, filterMode, currentTimestamp]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
            Inventario de Insumos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consulta general de existencias, lotes y estados de caducidad
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Indicador de conectividad y sincronización */}
          {isSyncing ? (
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 gap-1.5 py-1 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sincronizando...</span>
            </Badge>
          ) : isOnline ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 gap-1.5 py-1 text-xs"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Conectado (Supabase)</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 gap-1.5 py-1 text-xs"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Modo Offline (Dexie)</span>
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={!isOnline || isSyncing}
            className="gap-1.5 h-9 text-xs border-slate-200 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
            title="Sincronizar inventario con Supabase"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-600" : ""}`}
            />
            <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
          </Button>

          <Button
            onClick={() => navigate(ROUTES.SUPPLY_ENTRY)}
            className="shrink-0 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-9"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir insumos</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Píldoras de Filtro */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
            Filtrar Medicamentos:
          </span>
          <Button
            size="sm"
            variant={filterMode === "todos" ? "default" : "secondary"}
            onClick={() => setFilterMode("todos")}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filterMode === "caducan" ? "default" : "secondary"}
            onClick={() => setFilterMode("caducan")}
          >
            Caducan (&lt;30 días)
          </Button>
          <Button
            size="sm"
            variant={filterMode === "diez_dias" ? "default" : "secondary"}
            onClick={() => setFilterMode("diez_dias")}
          >
            Urgentes (&lt;10 días)
          </Button>
        </div>

        {/* Campo de Búsqueda */}
        <div className="relative w-full md:w-72">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por medicamento, clave o lote..."
            className="pr-9 h-9 text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </Card>

      {/* Tabla de Medicamentos */}
      {!inventoryItems ? (
        <Card className="p-12 text-center text-slate-500 text-sm">
          Cargando inventario local...
        </Card>
      ) : filteredMedicines.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">
            No se encontraron insumos en el inventario
          </p>
          <p className="text-xs text-slate-400 mb-4">
            {searchQuery
              ? "Intenta con otro término de búsqueda o limpia los filtros."
              : "Registra entradas de insumos médicos para visualizarlos en este listado."}
          </p>
          <Button
            variant="outline"
            onClick={() => navigate(ROUTES.SUPPLY_ENTRY)}
            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Plus className="w-4 h-4" />
            <span>Ingresar insumos al inventario</span>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 border border-slate-200/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SSA</TableHead>
                <TableHead>Medicamento</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Fech. caducidad</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Operaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMedicines.map((m) => {
                const criticalExpiry = isExpiringSoon(
                  m.fecha_caducidad,
                  15,
                  currentTimestamp,
                );
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium text-slate-700">
                      {m.clave_ssa || "00000"}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">
                      <div>{m.medicamento}</div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {m.presentacion}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-slate-600 font-semibold">
                      {m.lote}
                    </TableCell>
                    <TableCell>
                      {criticalExpiry ? (
                        <Badge variant="destructive">
                          {m.fecha_caducidad || "N/A"}
                        </Badge>
                      ) : (
                        <span className="text-slate-700 font-medium">
                          {m.fecha_caducidad || "N/A"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        {m.stock} piezas
                        {m.stock <= 5 && (
                          <span title="Stock bajo">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(m.id)}
                        title="Eliminar registro"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
