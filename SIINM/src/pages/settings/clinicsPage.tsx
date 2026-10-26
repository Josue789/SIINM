import React, { useEffect, useState, useMemo } from "react";
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
  Hospital,
  MapPin,
  Phone,
  Hash,
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
import { clinicaRepository } from "@/db/repositories/clinica.repository";
import { useNetwork } from "@/context/NetworkContext";
import type { Clinica } from "@/types/inventory.types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ClinicsPage: React.FC = () => {
  const { isOnline } = useNetwork();
  const [clinics, setClinics] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "activo" | "inactivo">("todos");

  // Estados del modal de creación / edición
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [idAtEdit, setIdAtEdit] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [clues, setClues] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados del modal de confirmación de eliminación
  const [isDialogDelete, setIsDialogDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Clinica | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Carga inicial y obtención de clínicas desde Supabase
  const fetchClinics = async () => {
    try {
      setLoading(true);
      const data = await clinicaRepository.getAll();
      setClinics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar clínicas";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();

    // Suscripción en tiempo real a cambios en Supabase
    const unsubscribe = clinicaRepository.subscribe(() => {
      fetchClinics();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Limpiar campos del formulario
  const resetForm = () => {
    setIsEditing(false);
    setIdAtEdit(null);
    setNombre("");
    setClues("");
    setUbicacion("");
    setTelefono("");
  };

  // Abrir diálogo para editar
  const openDialogToEdit = (clinic: Clinica) => {
    setIsEditing(true);
    setIdAtEdit(clinic.id);
    setNombre(clinic.nombre || "");
    setClues(clinic.clues || "");
    setUbicacion(clinic.ubicacion || "");
    setTelefono(clinic.telefono || "");
    setIsDialogOpen(true);
  };

  // Guardar (crear o actualizar)
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.warn("El nombre de la clínica es obligatorio");
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing && idAtEdit !== null) {
        await clinicaRepository.update(idAtEdit, {
          nombre: nombre.trim(),
          clues: clues.trim() || undefined,
          ubicacion: ubicacion.trim() || undefined,
          telefono: telefono.trim() || undefined,
        });
        toast.success("Clínica actualizada correctamente");
      } else {
        await clinicaRepository.create({
          nombre: nombre.trim(),
          clues: clues.trim() || undefined,
          ubicacion: ubicacion.trim() || undefined,
          telefono: telefono.trim() || undefined,
          activo: true,
        });
        toast.success("Clínica agregada exitosamente");
      }
      setIsDialogOpen(false);
      resetForm();
      await fetchClinics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar clínica";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cambiar estatus de la clínica
  const toggleClinicStatus = async (clinic: Clinica) => {
    const newStatus = !clinic.activo;
    try {
      await clinicaRepository.updateStatus(clinic.id, newStatus);
      toast.success(newStatus ? "Clínica activada" : "Clínica desactivada");
      await fetchClinics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cambiar estatus";
      toast.error(msg);
    }
  };

  // Confirmar eliminación
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await clinicaRepository.delete(itemToDelete.id);
      toast.success("Clínica eliminada correctamente");
      setIsDialogDelete(false);
      setItemToDelete(null);
      setConfirmationName("");
      await fetchClinics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar clínica";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtro y búsqueda reactiva
  const filteredClinics = useMemo(() => {
    const term = search.toLowerCase().trim();
    return clinics.filter((item) => {
      const name = (item.nombre || "").toLowerCase();
      const cluesVal = (item.clues || "").toLowerCase();
      const location = (item.ubicacion || "").toLowerCase();
      const phone = (item.telefono || "").toLowerCase();

      const matchesSearch =
        term === "" ||
        name.includes(term) ||
        cluesVal.includes(term) ||
        location.includes(term) ||
        phone.includes(term);

      if (filter === "activo") return matchesSearch && item.activo;
      if (filter === "inactivo") return matchesSearch && !item.activo;
      return matchesSearch;
    });
  }, [clinics, search, filter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0 flex items-center gap-2">
            <Hospital className="w-6 h-6 text-blue-600" />
            Catálogo de Unidades Médicas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de clínicas, centros de salud y almacenes (100% online con Supabase)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Indicador de conectividad */}
          {isOnline ? (
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
              <span>Sin conexión</span>
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchClinics}
            disabled={loading}
            className="gap-1.5 h-8 text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
            title="Recargar desde Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>

          {/* Diálogo para agregar o editar clínica */}
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="shrink-0 self-start sm:self-auto gap-2">
                <Plus className="w-4 h-4" />
                <span>Añadir Clínica</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={onSubmit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>
                    {isEditing ? "Editar Clínica" : "Añadir Nueva Clínica"}
                  </DialogTitle>
                  <DialogDescription>
                    Ingresa los datos de la unidad médica para registrarla en el sistema.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre de la Unidad *
                    </label>
                    <Input
                      placeholder="Ej. Centro de Salud Urbano No. 1"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Clave CLUES
                    </label>
                    <Input
                      placeholder="Ej. CSSSA001234"
                      value={clues}
                      onChange={(e) => setClues(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Ubicación / Dirección
                    </label>
                    <Input
                      placeholder="Ej. Av. Hidalgo #100, Col. Centro"
                      value={ubicacion}
                      onChange={(e) => setUbicacion(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Teléfono de Contacto
                    </label>
                    <Input
                      placeholder="Ej. 55 1234 5678"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Guardar Clínica"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Diálogo de confirmación para eliminar */}
          <AlertDialog open={isDialogDelete} onOpenChange={setIsDialogDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 font-bold">
                  ¿Eliminar clínica?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block text-sm text-slate-600">
                    Esta acción eliminará permanentemente la clínica{" "}
                    <strong>"{itemToDelete?.nombre}"</strong> en Supabase.
                  </span>
                  <span className="block text-xs text-slate-500">
                    Escribe exactamente <strong>{itemToDelete?.nombre}</strong> para confirmar:
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <Input
                type="text"
                placeholder={itemToDelete?.nombre || ""}
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                className="text-xs"
              />

              <AlertDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogDelete(false);
                    setItemToDelete(null);
                    setConfirmationName("");
                  }}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmDelete}
                  disabled={
                    isDeleting ||
                    confirmationName.trim() !== (itemToDelete?.nombre || "").trim()
                  }
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {isDeleting ? "Eliminando..." : "Confirmar Eliminación"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
            Filtrar Unidades:
          </span>
          <Button
            size="sm"
            variant={filter === "todos" ? "default" : "secondary"}
            onClick={() => setFilter("todos")}
          >
            Todas ({clinics.length})
          </Button>
          <Button
            size="sm"
            variant={filter === "activo" ? "default" : "secondary"}
            onClick={() => setFilter("activo")}
          >
            Activas ({clinics.filter((c) => c.activo).length})
          </Button>
          <Button
            size="sm"
            variant={filter === "inactivo" ? "default" : "secondary"}
            onClick={() => setFilter("inactivo")}
          >
            Inactivas ({clinics.filter((c) => !c.activo).length})
          </Button>
        </div>

        <div className="relative w-full md:w-80">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, CLUES, dirección..."
            className="pr-9 h-9 text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </Card>

      {/* Tabla de Clínicas */}
      <Card className="overflow-hidden p-0 border border-slate-200/80">
        <Table>
          <TableHeader>
            <TableRow className="border-0 bg-gray-50">
              <TableHead className="text-gray-800">CLUES</TableHead>
              <TableHead className="text-gray-800">Nombre de la Unidad</TableHead>
              <TableHead className="text-gray-800">Ubicación</TableHead>
              <TableHead className="text-gray-800">Teléfono</TableHead>
              <TableHead className="text-gray-800">Estatus</TableHead>
              <TableHead className="text-right">Operaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-36 text-center text-slate-500 py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-xs text-slate-500">Cargando clínicas desde Supabase...</p>
                </TableCell>
              </TableRow>
            ) : filteredClinics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-36 text-center text-slate-500 py-8">
                  <p className="font-semibold text-sm text-slate-700 mb-1">
                    No se encontraron clínicas registradas
                  </p>
                  <p className="text-xs text-slate-400">
                    Puedes dar de alta una nueva unidad usando el botón "+ Añadir Clínica".
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredClinics.map((item) => {
                return (
                  <TableRow key={item.id} className="border-0 hover:bg-slate-50/70 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-slate-700">
                      {item.clues ? (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          <Hash className="w-3 h-3 text-slate-400" />
                          {item.clues}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Sin CLUES</span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-slate-800">
                      {item.nombre}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {item.ubicacion ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.ubicacion}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">---</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {item.telefono ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.telefono}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">---</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${
                          item.activo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {item.activo ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="dark:bg-white dark:border-gray-200">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => openDialogToEdit(item)}
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-100 p-2 text-xs flex items-center"
                            >
                              <PencilIcon className="w-4 h-4 mr-2" />
                              <span>Editar</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-100 p-2 text-xs flex items-center border-t border-slate-100"
                              onClick={() => toggleClinicStatus(item)}
                            >
                              {item.activo ? (
                                <div className="flex items-center text-amber-600">
                                  <EyeOff className="w-4 h-4 mr-2" />
                                  <span>Desactivar</span>
                                </div>
                              ) : (
                                <div className="flex items-center text-emerald-600">
                                  <EyeIcon className="w-4 h-4 mr-2" />
                                  <span>Activar</span>
                                </div>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="cursor-pointer dark:text-gray-800 hover:bg-gray-100 p-2 text-xs flex items-center text-red-600 border-t border-slate-100"
                              onClick={() => {
                                setItemToDelete(item);
                                setConfirmationName("");
                                setIsDialogDelete(true);
                              }}
                            >
                              <Trash2Icon className="w-4 h-4 mr-2" />
                              <span>Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
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
