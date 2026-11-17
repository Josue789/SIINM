import React, { useEffect, useState } from "react";
import {
  Search,
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  Save,
  LoaderCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import type { Clinica, InventarioItem } from "@/types/inventory.types";
import { inventarioRepository } from "@/db/repositories/inventario.repository";
import { clinicaRepository } from "@/db/repositories/clinica.repository";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

type FilterMode = "todos" | "correctos" | "urgentes" | "criticos";

const parseExpirationDate = (expirationDate?: string): number | null => {
  if (!expirationDate || expirationDate === "N/A") return null;
  const trimmed = expirationDate.trim();
  if (!trimmed) return null;

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

export const SupervisionPage: React.FC = () => {
  const [selectedClinic, setSelectedClinic] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("todos");
  const [currentTimestamp] = useState(() => Date.now());

  const [clinicsData, setClinicsData] = useState<Clinica[]>([]);
  const [inventarios, setInventarios] = useState<InventarioItem[]>([]);
  const [idToEdit, setIdToEdit] = useState("");
  const [stock, setStock] = useState(0);
  const [loteToVerify, setLoteToVerify] = useState("");
  const [medicineToDelete, setMedicineToDelete] =
    useState<InventarioItem | null>(null);

  const [pageLoad, setPageLoad] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClinicsList = async () => {
    try {
      const response = await clinicaRepository.getAll();
      setClinicsData(response);
      if (response && response.length > 0) {
        setSelectedClinic(response[0].id);
      }
    } catch (error) {
      console.error("Error fetching clinics data:", error);
    }
  };
  const fetchClinicsData = async () => {
    try {
      const response = await inventarioRepository.getAll();
      setInventarios(response);
    } catch (error) {
      console.error("Error fetching clinics data:", error);
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
      setPageLoad(true);
      try {
        await Promise.all([fetchClinicsList(), fetchClinicsData()]);
      } finally {
        setPageLoad(false);
      }
    };
    loadAllData();
  }, []);

  const filteredData = inventarios
    .filter((item) => {
      const medName = (item.medicamento || "").toLowerCase();
      const ssaCode = (item.clave_ssa || "").toLowerCase();
      const batchNum = (item.lote || "").toLowerCase();
      const query = search.trim().toLowerCase();

      const searchMatch =
        !query ||
        medName.includes(query) ||
        ssaCode.includes(query) ||
        batchNum.includes(query);

      const clinicMatch =
        selectedClinic === 0 ||
        Number(item.id_clinica) === Number(selectedClinic);

      if (!searchMatch || !clinicMatch) return false;

      if (filterMode !== "todos") {
        const category = getExpiryFilterCategory(
          item.fecha_caducidad,
          currentTimestamp,
        );
        return category === filterMode;
      }

      return true;
    })
    .sort((a, b) => {
      // Ordenamiento FEFO (First Expired, First Out)
      const timeA = parseExpirationDate(a.fecha_caducidad) ?? Number.MAX_SAFE_INTEGER;
      const timeB = parseExpirationDate(b.fecha_caducidad) ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });

  // Paginación con @tanstack/react-table (useTable)
  const { table, paginatedData: paginatedData } = usePaginatedTable(
    filteredData,
    10,
  );

  const saveChanges = async () => {
    setIsUpdating(true);
    try {
      await inventarioRepository.updateStock({
        recordId: idToEdit,
        newStock: stock,
        reason: "Ajuste",
      });
      await fetchClinicsData();
      toast.success("Stock actualizado exitosamente");
      setIdToEdit("");
      setIsUpdating(false);
    } catch {
      setIsUpdating(false);
      toast.error("Error al actualizar el stock");
    }
  };

  const deleteMedicine = async () => {
    if (!medicineToDelete?.id) return;
    setIsDeleting(true);
    try {
      await inventarioRepository.delete(medicineToDelete.id);
      await fetchClinicsData();
      toast.success("Medicamento eliminado exitosamente");
      setMedicineToDelete(null);
      setLoteToVerify("");
      setOpenDialog(false);
      setIsDeleting(false);
    } catch {
      setIsDeleting(false);
      toast.error("Error al eliminar el medicamento");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Supervisión de Clínicas
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitoreo consolidado de inventarios por unidad y clínica médica (Ordenamiento FEFO)
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Unidad Médica:
            </span>
            {pageLoad ? (
              <Skeleton className="w-36 h-6 rounded-xl bg-slate-200" />
            ) : (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />

                <select
                  value={selectedClinic}
                  onChange={(e) => setSelectedClinic(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {clinicsData.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="relative w-full md:w-72">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar medicamento, clave o lote..."
              className="pr-9 h-9 text-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Filtros de caducidad FEFO */}
        <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
            Semáforo FEFO:
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
      </Card>

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
            {pageLoad ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <TableRow
                  key={`skeleton-row-${idx}`}
                  className="border-b border-slate-100/80"
                >
                  <TableCell className="py-2">
                    <Skeleton className="h-4 w-20 bg-slate-200" />
                  </TableCell>
                  <TableCell className="py-2">
                    <Skeleton className="h-4 w-48 bg-slate-200" />
                  </TableCell>
                  <TableCell className="py-2">
                    <Skeleton className="h-4 w-16 bg-slate-200" />
                  </TableCell>
                  <TableCell className="py-2">
                    <Skeleton className="h-4 w-24 rounded-full bg-slate-200" />
                  </TableCell>
                  <TableCell className="py-2">
                    <Skeleton className="h-4 w-12 bg-slate-200" />
                  </TableCell>
                  <TableCell className="py-2 flex justify-center items-center">
                    <Skeleton className="h-4 w-8 rounded-md bg-slate-200" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-slate-400 text-xs font-medium"
                >
                  No se encontraron medicamentos para esta clínica
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item) => {
                const expiryCategory = getExpiryFilterCategory(
                  item.fecha_caducidad,
                  currentTimestamp,
                );
                const itemIdStr = String(item.id ?? "");
                return (
                <TableRow key={item.id} className="border-0">
                  <TableCell className="font-mono font-medium text-slate-700">
                    {item.clave_ssa}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">
                    {item.medicamento}
                  </TableCell>
                  <TableCell className="font-mono text-slate-600">
                    {item.lote}
                  </TableCell>
                  <TableCell className="font-bold">
                    <Badge
                      variant={
                        expiryCategory === "criticos"
                          ? "destructive"
                          : expiryCategory === "urgentes"
                            ? "warning"
                            : expiryCategory === "correctos"
                              ? "success"
                              : "secondary"
                      }
                    >
                      {item.fecha_caducidad || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-slate-800">
                    {idToEdit === itemIdStr ? (
                      <div className="flex flex-row items-center space-x-2">
                        <Input
                          type="number"
                          value={stock}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setStock(value >= 0 ? value : 0);
                          }}
                          className="w-42"
                        />
                        <Button
                          className="hover:border-red-700 hover:text-red-700 hover:bg-red-200"
                          variant="outline"
                          size="sm"
                          onClick={() => setIdToEdit("")}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveChanges()}
                          className="hover:bg-green-200 hover:text-green-700"
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Save className="" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      item.stock
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="dark:bg-white dark:border-gray-200 ">
                        <DropdownMenuItem
                          onClick={() => {
                            setStock(item.stock);
                            setIdToEdit(itemIdStr);
                          }}
                          className="cursor-pointer dark:text-gray-800 hover:bg-gray-200 p-2 text-xs flex items-center"
                        >
                          <Pencil className="w-4 h-4 mr-2 " />
                          Ajustar Cantidad
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setOpenDialog(true);
                            setMedicineToDelete(item);
                          }}
                          className="cursor-pointer dark:text-red-600 hover:bg-gray-200 p-2 text-xs flex items-center text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2 " />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {!pageLoad && filteredData.length > 0 && (
          <TablePagination table={table} />
        )}
      </Card>
      {/* Diálogo para confirmar eliminacion */}
      <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
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
                setOpenDialog(false);
                setLoteToVerify("");
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                loteToVerify === medicineToDelete?.lote
                  ? deleteMedicine()
                  : null
              }
              disabled={loteToVerify !== medicineToDelete?.lote || isDeleting}
            >
              {isDeleting ? <LoaderCircle /> : <p>Continuar</p>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
