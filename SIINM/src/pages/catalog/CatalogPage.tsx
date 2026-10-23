import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  Search,
  MoreVertical,
  PencilIcon,
  Trash2Icon,
  EyeOff,
  EyeIcon,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "react-toastify";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { medicineRepository } from "@/db/repositories/medicine.repository";
import { useNetwork } from "@/context/NetworkContext";
import type { CatalogoMedicamento } from "@/types/inventory.types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";

export const CatalogPage: React.FC = () => {
  const { isOnline, isSyncing, triggerSync } = useNetwork();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSsa, setNewSsa] = useState("");
  const [newMedicine, setNewMedicine] = useState("");
  const [newPresentation, setNewPresentation] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newCode, setNewCode] = useState("");
  const [isAddingMedicine, setIsAddingMedicine] = useState(true);
  const [idAtEdit, setIdAtEdit] = useState("");
  const [isDialogDelete, setIsDialogDelete] = useState(false);
  const [codeConfirmation, setCodeConfirmation] = useState("");
  const [itemToDelete, setItemToDelete] = useState<CatalogoMedicamento | null>(
    null,
  );

  // Consulta reactiva a Dexie en tiempo real. Se actualiza sola cuando llega un evento
  // de Supabase Realtime o una mutación local. No requiere polling ni bucles de conexión.
  const catalogItems =
    useLiveQuery(
      () => medicineRepository.getAll(),
      [],
      [] as CatalogoMedicamento[],
    ) || [];

  const updateMedicineStatus = async (id: string, newStatus: string) => {
    await medicineRepository.updateStatus(id, newStatus);
    if (isOnline) {
      triggerSync().catch(console.error);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isAddingMedicine) {
      handleAddMedicine(e);
    } else {
      handleUpdateMedicine(e);
    }
  };

  const handleUpdateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedicine.trim()) return;

    const medicine: Partial<CatalogoMedicamento> = {
      codigo_barras: newCode.trim() || "",
      clave_ssa: newSsa.trim() || "00000",
      medicamento: newMedicine.trim(),
      presentacion: newPresentation.trim() || "Pieza",
      cantidadPorPieza: parseInt(newQuantity) || 1,
      activo: true,
    };
    await medicineRepository.update(idAtEdit, medicine);

    if (isOnline) {
      triggerSync().catch(console.error);
    }

    setIdAtEdit("");
    setNewSsa("");
    setNewMedicine("");
    setNewPresentation("");
    setNewQuantity("1");
    setNewCode("");
    setIsDialogOpen(false);
    setIsAddingMedicine(true);
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedicine.trim()) return;

    const medicine: CatalogoMedicamento = {
      id: crypto.randomUUID(),
      codigo_barras: newCode.trim() || "",
      clave_ssa: newSsa.trim() || "00000",
      medicamento: newMedicine.trim(),
      presentacion: newPresentation.trim() || "Pieza",
      cantidadPorPieza: parseInt(newQuantity) || 1,
      activo: true,
    };
    try {
      await medicineRepository.create(medicine);
    } catch (error) {
      toast(medicine.codigo_barras + " ya existe en el catálogo");
    }

    if (isOnline) {
      triggerSync().catch(console.error);
    }

    setNewSsa("");
    setNewMedicine("");
    setNewPresentation("");
    setNewQuantity("1");
    setNewCode("");
    setIsDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !codeConfirmation) return;
    if (codeConfirmation.trim() !== itemToDelete.codigo_barras.trim()) return;
    await medicineRepository.delete(itemToDelete.id);
    if (isOnline) {
      triggerSync().catch(console.error);
    }
    setIsDialogDelete(false);
    setCodeConfirmation("");
    setItemToDelete(null);
  };

  const filteredItems = catalogItems.filter((item) => {
    const medName = (item.medicamento || item.name || "").toLowerCase();
    const ssaCode = (item.clave_ssa || item.ssa || "").toLowerCase();
    const barcode = (item.codigo_barras || "").toLowerCase();
    const searchLower = (search || "").toLowerCase().trim();

    const matchesSearch =
      searchLower === "" ||
      medName.includes(searchLower) ||
      ssaCode.includes(searchLower) ||
      barcode.includes(searchLower);

    const isActivo =
      typeof item.activo === "boolean"
        ? item.activo
        : item.estatus === "Activo";

    if (filter === "todos") {
      return matchesSearch;
    } else if (filter === "activo") {
      return isActivo && matchesSearch;
    } else if (filter === "inactivo") {
      return !isActivo && matchesSearch;
    }
    return matchesSearch;
  });

  const openDialogToEdit = (item: CatalogoMedicamento) => {
    setIsAddingMedicine(false);
    setIsDialogOpen(true);
    setIdAtEdit(item.id);
    setNewSsa(item.clave_ssa);
    setNewMedicine(item.medicamento);
    setNewPresentation(item.presentacion);
    setNewQuantity(item.cantidadPorPieza.toString());
    setNewCode(item.codigo_barras);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
            Catálogo Maestro
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Catálogo institucional de medicamentos, cuadros básicos y
            especificaciones
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
            onClick={() => triggerSync(true)}
            disabled={!isOnline || isSyncing}
            className="gap-1.5 h-7 text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
            title="Sincronizar con Supabase"
          >
            <RefreshCw
              className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`}
            />
            <span>Sincronizar</span>
          </Button>
          {/* Dialogo para agregar o editar un medicamento */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0 self-start sm:self-auto gap-2">
                <Plus className="w-4 h-4" />
                <span>Añadir medicamento</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>
                    {isAddingMedicine
                      ? "Añadir Nuevo Medicamento"
                      : "Editar Medicamento"}
                  </DialogTitle>
                  <DialogDescription>
                    Ingresa los detalles técnicos del medicamento para darlo de
                    alta en el catálogo maestro.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Clave SSA
                    </label>
                    <Input
                      placeholder="Ej. 010.000.0410.00"
                      value={newSsa}
                      onChange={(e) => setNewSsa(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Codigo de barras
                    </label>
                    <Input
                      placeholder="Ej. 7501012345678"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre del Medicamento
                    </label>
                    <Input
                      placeholder="Ej. Paracetamol 500mg"
                      value={newMedicine}
                      onChange={(e) => setNewMedicine(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Presentación
                      </label>
                      <Input
                        placeholder="Ej. Caja c/20 tabletas"
                        value={newPresentation}
                        onChange={(e) => setNewPresentation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar Medicamento</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Dialogo para eliminar */}
          <AlertDialog open={isDialogDelete} onOpenChange={setIsDialogDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>Confirma la operacion</AlertDialogHeader>
              <AlertDialogDescription>
                <span className="font-bold text-shadow-red-500">
                  Al eliminar este medicamento perdera la relacion con sus lotes
                </span>
                <p className="text-sm my-5">
                  Para continuar con la operacion escanea o ingresa el codigo de
                  barras del medicamento
                </p>
              </AlertDialogDescription>
              <Input
                type="text"
                value={codeConfirmation}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (codeConfirmation !== itemToDelete?.codigo_barras) {
                      return;
                    }
                    setCodeConfirmation("");
                    setIsDialogDelete(false);
                    confirmDelete();
                  }
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setCodeConfirmation(value);
                }}
                required
              />
              <AlertDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogDelete(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  onClick={confirmDelete}
                  disabled={codeConfirmation !== itemToDelete?.codigo_barras}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Eliminar Medicamento
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
            Filtrar Medicamentos:
          </span>
          <Button
            size="sm"
            variant={filter === "todos" ? "default" : "secondary"}
            onClick={() => setFilter("todos")}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filter === "activo" ? "default" : "secondary"}
            onClick={() => setFilter("activo")}
          >
            Activos
          </Button>
          <Button
            size="sm"
            variant={filter === "inactivo" ? "default" : "secondary"}
            onClick={() => setFilter("inactivo")}
          >
            Inactivos
          </Button>
        </div>

        <div className="relative w-full md:w-72">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar medicamento..."
            className="pr-9 h-9 text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </Card>

      <Card className="overflow-hidden p-0 border border-slate-200/80">
        <Table>
          <TableHeader>
            <TableRow className="border-0 bg-gray-50">
              <TableHead className="text-gray-800">SSA</TableHead>
              <TableHead className="text-gray-800">Medicamento</TableHead>
              <TableHead className="text-gray-800">Presentación</TableHead>

              <TableHead className="text-gray-800">Estatus</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-36 text-center text-slate-500 py-8"
                >
                  <p className="font-semibold text-sm text-slate-700 mb-1">
                    No se encontraron medicamentos en el catálogo
                  </p>
                  <p className="text-xs text-slate-400">
                    Puedes agregar uno nuevo usando el botón "+ Añadir
                    medicamento".
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isActivo =
                  typeof item.activo === "boolean"
                    ? item.activo
                    : item.estatus === "Activo";
                const estatusText = isActivo ? "Activo" : "Inactivo";
                return (
                  <TableRow key={item.id} className="border-0">
                    <TableCell className="font-mono font-medium text-slate-700">
                      {item.clave_ssa || item.ssa || "---"}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">
                      {item.medicamento || item.name || "---"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {item.presentacion || "Pieza"}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${
                          isActivo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {estatusText}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="dark:bg-white dark:border-gray-200">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => {
                                openDialogToEdit(item);
                              }}
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-100"
                            >
                              <div className="flex items-center">
                                <PencilIcon className="w-4 h-4 mr-2" />
                                <p>Editar</p>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete(item);
                                setIsDialogDelete(true);
                              }}
                            >
                              <div className="flex items-center text-red-500">
                                <Trash2Icon className="w-4 h-4 mr-2" />
                                <p>Eliminar</p>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuItem
                            className="cursor-pointer dark:text-gray-800 hover:bg-gray-100 border-t-gray-100 border-t-2"
                            onClick={() => {
                              const newStatus = isActivo
                                ? "Inactivo"
                                : "Activo";
                              updateMedicineStatus(item.id, newStatus);
                            }}
                          >
                            {isActivo ? (
                              <div className="flex items-center text-red-500">
                                <EyeOff className="w-4 h-4 mr-2" />
                                <p>Desactivar</p>
                              </div>
                            ) : (
                              <div className="flex items-center text-green-500">
                                <EyeIcon className="w-4 h-4 mr-2" />
                                <p>Activar</p>
                              </div>
                            )}
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
      </Card>
    </div>
  );
};
