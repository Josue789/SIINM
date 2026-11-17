import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
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
  TablePagination,
  usePaginatedTable,
} from "@/components/ui/table";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FilterMode = "todos" | "correctos" | "urgentes" | "criticos";

export interface DisplayInventoryItem {
  id: string | number;
  clave_ssa: string;
  medicamento: string;
  presentacion: string;
  lote: string;
  fecha_caducidad: string;
  stock: number;
}

// Parsea distintos formatos de fecha de caducidad (YYYY-MM-DD, DD/MM/YYYY, MM/YY, MM/YYYY)
const parseExpirationDate = (expirationDate?: string): number | null => {
  if (!expirationDate || expirationDate === "N/A") return null;
  const trimmed = expirationDate.trim();
  if (!trimmed) return null;

  // Formato con diagonales: MM/YY, MM/YYYY o DD/MM/YYYY
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/").map(Number);
    if (parts.some(isNaN)) return null;

    if (parts.length === 2) {
      const m = parts[0];
      const y = parts[1] < 100 ? parts[1] + 2000 : parts[1];
      if (m < 1 || m > 12) return null;
      return new Date(y, m, 0, 23, 59, 59, 999).getTime();
    }

    if (parts.length === 3) {
      const d = parts[0];
      const m = parts[1];
      const y = parts[2] < 100 ? parts[2] + 2000 : parts[2];
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    }
  }

  // Formato ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }

  const parsed = new Date(trimmed).getTime();
  return isNaN(parsed) ? null : parsed;
};

// Clasifica la fecha de caducidad según los rangos del semáforo:
// - 'criticos': < 6 meses (< 180 días, incluyendo ya caducados)
// - 'urgentes': 6 a 12 meses (entre 180 y 365 días)
// - 'correctos': > 12 meses (> 365 días)
const getExpiryFilterCategory = (
  expirationDate?: string,
  currentTimestamp = Date.now(),
): "correctos" | "urgentes" | "criticos" | null => {
  const expTime = parseExpirationDate(expirationDate);
  if (expTime === null) return null;

  const diffDays = (expTime - currentTimestamp) / (1000 * 60 * 60 * 24);

  if (diffDays < 180) {
    return "criticos";
  }
  if (diffDays <= 365) {
    return "urgentes";
  }
  return "correctos";
};

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, isSyncing, triggerSync, refreshPendingCount } =
    useNetwork();
  const [filterMode, setFilterMode] = useState<FilterMode>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTimestamp] = useState(() => Date.now());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [medicineToDelete, setMedicineToDelete] =
    useState<DisplayInventoryItem | null>(null);
  const [loteToVerify, setLoteToVerify] = useState<string>("");

  // Limpiar cualquier registro duplicado residual en Dexie al montar la página
  useEffect(() => {
    inventarioRepository.deduplicateLocal().catch(console.warn);
  }, []);

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
      const msg =
        err instanceof Error
          ? err.message
          : "Error al sincronizar con Supabase";
      toast.error(msg);
    }
  };

  // Consulta reactiva a Dexie: une inventario local y medicines, eliminando duplicados
  const inventoryItems = useLiveQuery(
    async (): Promise<DisplayInventoryItem[]> => {
      try {
        const localInventario = await db.inventario.toArray();
        if (localInventario && localInventario.length > 0) {
          const dedupMap = new Map<string, DisplayInventoryItem>();

          for (const item of localInventario) {
            // Filtrar por clínica si el usuario tiene una clínica asignada
            if (
              user?.clinicaId &&
              Number(item.id_clinica) !== Number(user.clinicaId)
            ) {
              continue;
            }

            const medKey = String(item.id_medicamento || item.clave_ssa || "")
              .trim()
              .toLowerCase();
            const loteKey = String(item.lote || "")
              .trim()
              .toLowerCase();
            const key = `${item.id_clinica}-${medKey}-${loteKey}`;

            const displayItem: DisplayInventoryItem = {
              id: item.id || key,
              clave_ssa: item.clave_ssa || "",
              medicamento: item.medicamento || "Medicamento sin nombre",
              presentacion: item.presentacion || "Pieza",
              lote: item.lote || "00000",
              fecha_caducidad: item.fecha_caducidad || "N/A",
              stock: Number(item.stock) || 0,
            };

            const existing = dedupMap.get(key);
            if (!existing) {
              dedupMap.set(key, displayItem);
            } else {
              // Priorizar el registro que tenga ID numérico (remoto de Supabase) frente al UUID temporal
              const currentHasNumericId =
                typeof item.id === "number" ||
                (!isNaN(Number(item.id)) && !String(item.id).includes("-"));
              if (currentHasNumericId) {
                dedupMap.set(key, displayItem);
              }
            }
          }

          return Array.from(dedupMap.values());
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
    [user?.clinicaId],
    [],
  );

  const DeleteMedicine = async () => {
    setConfirmDelete(false);
    if (!medicineToDelete) return;

    try {
      await inventarioRepository.delete(medicineToDelete.id);
      await refreshPendingCount();
      toast.success("Registro eliminado del inventario");
    } catch (err) {
      console.error("Error al eliminar del inventario:", err);
      toast.error("No se pudo eliminar el registro");
    }
  };

  const handleDelete = (medicine: DisplayInventoryItem) => {
    setConfirmDelete(true);
    setMedicineToDelete(medicine);
  };

  const filteredMedicines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (inventoryItems || [])
      .filter((m) => {
        const medName = (m.medicamento || "").toLowerCase();
        const ssaCode = (m.clave_ssa || "").toLowerCase();
        const batchNum = (m.lote || "").toLowerCase();

        const matchesSearch =
          !query ||
          medName.includes(query) ||
          ssaCode.includes(query) ||
          batchNum.includes(query);

        if (!matchesSearch) return false;

        if (filterMode !== "todos") {
          const category = getExpiryFilterCategory(
            m.fecha_caducidad,
            currentTimestamp,
          );
          return category === filterMode;
        }

        return true;
      })
      .sort((a, b) => {
        // Ordenamiento FEFO (First Expired, First Out)
        const timeA =
          parseExpirationDate(a.fecha_caducidad) ?? Number.MAX_SAFE_INTEGER;
        const timeB =
          parseExpirationDate(b.fecha_caducidad) ?? Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      });
  }, [inventoryItems, searchQuery, filterMode, currentTimestamp]);

  // Paginación con @tanstack/react-table (useTable)
  const { table, paginatedData: paginatedMedicines } = usePaginatedTable(
    filteredMedicines,
    10,
  );

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
            variant={filterMode === "correctos" ? "default" : "secondary"}
            onClick={() => setFilterMode("correctos")}
          >
            Correctos (&gt; 12 meses)
          </Button>
          <Button
            size="sm"
            variant={filterMode === "urgentes" ? "default" : "secondary"}
            onClick={() => setFilterMode("urgentes")}
          >
            Urgentes (6 - 12 meses)
          </Button>
          <Button
            size="sm"
            variant={filterMode === "criticos" ? "default" : "secondary"}
            onClick={() => setFilterMode("criticos")}
          >
            Críticos (&lt; 6 meses)
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
                {user?.role !== "Personal" && (
                  <TableHead className="text-right">Operaciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMedicines.map((m) => {
                const expiryCategory = getExpiryFilterCategory(
                  m.fecha_caducidad,
                  currentTimestamp,
                );
                return (
                  <TableRow key={m.id} className="border-0">
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
                      {expiryCategory === "criticos" ? (
                        <Badge variant="destructive">
                          {m.fecha_caducidad || "N/A"}
                        </Badge>
                      ) : expiryCategory === "urgentes" ? (
                        <Badge variant="warning">
                          {m.fecha_caducidad || "N/A"}
                        </Badge>
                      ) : expiryCategory === "correctos" ? (
                        <Badge variant="success">
                          {m.fecha_caducidad || "N/A"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {m.fecha_caducidad || "N/A"}
                        </Badge>
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
                    {user?.role !== "Personal" && (
                      <TableCell className="flex justify-center items-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(m)}
                          title="Eliminar registro"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination table={table} />
        </Card>
      )}
      <AlertDialog open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Deseas quitar {medicineToDelete?.medicamento} del inventario?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="text-sm mb-3">
                Para eliminar el medicamento ingresa su lote:
              </p>
              <Input
                type="text"
                value={loteToVerify}
                onChange={(e) => setLoteToVerify(e.target.value)}
              />
              {loteToVerify === medicineToDelete?.lote && (
                <span className="text-red-500 text-sm font-semibold italic">
                  * Recuerda quitar físicamente el medicamento del almacén
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmDelete(false);
                setLoteToVerify("");
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                loteToVerify === medicineToDelete?.lote
                  ? DeleteMedicine()
                  : null
              }
              disabled={loteToVerify !== medicineToDelete?.lote}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
