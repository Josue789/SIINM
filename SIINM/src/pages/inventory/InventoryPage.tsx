import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Search, AlertTriangle, Trash2 } from "lucide-react";
import { medicineRepository } from "@/db/repositories/medicine.repository";
import { useNetwork } from "@/context/NetworkContext";
import type { Medicine } from "@/types/inventory.types";
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

type FilterMode = "todos" | "caducan" | "diez_dias";

export const InventoryPage: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const { refreshPendingCount } = useNetwork();

  const loadMedicines = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await medicineRepository.getAll();
      setMedicines(items as unknown as Medicine[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const handleDelete = async (id: string) => {
    await medicineRepository.delete(id);
    await loadMedicines();
    await refreshPendingCount();
  };

  // Check if expiration date is within N days
  const isExpiringSoon = (expirationDate?: string, maxDays = 30) => {
    if (!expirationDate) return false;
    const exp = new Date(expirationDate).getTime();
    const now = Date.now();
    const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
    return diffDays <= maxDays;
  };

  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      // Búsqueda por texto
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.batchNumber &&
          m.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Filtros por píldoras
      if (filterMode === "caducan") {
        return isExpiringSoon(m.expirationDate, 30);
      }
      if (filterMode === "diez_dias") {
        return isExpiringSoon(m.expirationDate, 10);
      }

      return true;
    });
  }, [medicines, searchQuery, filterMode]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Encabezado Principal según Figma */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
            Inventario de Insumo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consulta general de existencias, lotes y estados de caducidad
          </p>
        </div>

        <Button
          onClick={() => {}}
          className="shrink-0 self-start sm:self-auto gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>+ Añadir medicamento</span>
        </Button>
      </div>

      {/* Barra de Filtros y Búsqueda según Figma Desktop - 3 */}
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
            Caducan
          </Button>
          <Button
            size="sm"
            variant={filterMode === "diez_dias" ? "default" : "secondary"}
            onClick={() => setFilterMode("diez_dias")}
          >
            &lt;10 días
          </Button>
        </div>

        {/* Campo de Búsqueda */}
        <div className="relative w-full md:w-72">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar medicamento..."
            className="pr-9 h-9 text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </Card>

      {/* Tabla de Medicamentos con componentes shadcn/ui */}
      {isLoading ? (
        <Card className="p-12 text-center text-slate-500 text-sm">
          Cargando inventario local...
        </Card>
      ) : filteredMedicines.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">
            No se encontraron medicamentos
          </p>
          <p className="text-xs text-slate-400 mb-4">
            {searchQuery
              ? "Intenta con otro término de búsqueda o limpia los filtros."
              : "Agrega medicamentos para visualizarlos en el catálogo."}
          </p>
          <Button
            variant="outline"
            onClick={() => {}}
            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Plus className="w-4 h-4" />
            <span>Crear medicamento</span>
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
                const criticalExpiry = isExpiringSoon(m.expirationDate, 15);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium text-slate-700">
                      {m.code || "00000"}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">
                      <div>{m.name}</div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {m.dosageForm || m.category}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-slate-600">
                      {m.batchNumber || "00000"}
                    </TableCell>
                    <TableCell>
                      {criticalExpiry ? (
                        <Badge variant="destructive">
                          {m.expirationDate || "N/A"}
                        </Badge>
                      ) : (
                        <span className="text-slate-700 font-medium">
                          {m.expirationDate || "N/A"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        {m.stock}
                        {m.stock <= m.minStock && (
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
