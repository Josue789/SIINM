import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Check,
  X,
  Trash2,
  Search,
  Building2,
  PackageCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveQuery } from "dexie-react-hooks";
import { medicineRepository } from "@/db/repositories/catalogoMedicamento.repository";
import { clinicaRepository } from "@/db/repositories/clinica.repository";
import { inventarioRepository } from "@/db/repositories/inventario.repository";
import { useAuth } from "@/context/AuthContext";
import { useNetwork } from "@/context/NetworkContext";
import type { CatalogoMedicamento, Clinica } from "@/types/inventory.types";
import { toast } from "react-toastify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface IncomingItem {
  id: string;
  medicineId: string | number;
  name: string;
  ssa: string;
  lote: string;
  caducidad: string;
  quantity: number;
  barcode?: string;
}

export const SupplyEntryPage: React.FC = () => {
  const { user } = useAuth();
  const { triggerSync } = useNetwork();

  const [barcode, setBarcode] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [ssa, setSsa] = useState("");
  const [quantityPerPiece, setQuantityPerPiece] = useState("1");
  const [expiryDate, setExpiryDate] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [searchByData, setSearchByData] = useState(false);

  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [selectedClinicaId, setSelectedClinicaId] = useState<number | null>(
    null,
  );

  // Estados del modal de confirmación
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar lista de clínicas para asociar la clínica del usuario
  useEffect(() => {
    clinicaRepository
      .getAll()
      .then((data) => {
        setClinicas(data);
        if (user?.clinicaId) {
          setSelectedClinicaId(user.clinicaId);
        } else if (data.length > 0) {
          setSelectedClinicaId(data[0].id);
        }
      })
      .catch((err) => {
        console.warn("Error al cargar clínicas:", err);
      });
  }, [user?.clinicaId]);

  // Clínica asignada del usuario o seleccionada
  const assignedClinica = useMemo(() => {
    const targetId = user?.clinicaId ?? selectedClinicaId;
    return clinicas.find((c) => c.id === targetId);
  }, [clinicas, user?.clinicaId, selectedClinicaId]);

  // Consulta reactiva a Dexie del catálogo maestro
  const catalogItems =
    useLiveQuery(
      async () => {
        const meds = await medicineRepository.getAll();
        return meds.filter((m) => m.activo === true);
      },
      [],
      [] as CatalogoMedicamento[],
    ) || [];

  // Agrega el medicamento a la lista de incomingItems
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!medicineName.trim()) {
      toast.error("Selecciona o ingresa un medicamento");
      return;
    }
    if (!ssa) {
      toast.error("Falta la clave SSA del medicamento");
      return;
    }
    if (!lotNumber.trim()) {
      toast.error("El número de lote es obligatorio");
      return;
    }
    if (!expiryDate) {
      toast.error("La fecha de caducidad es obligatoria");
      return;
    }

    // Validar fecha de caducidad (soporta YYYY-MM-DD y MM/YYYY)
    let expiryYear = 0;
    let expiryMonth = 0;
    let expiryDay = 0;

    if (expiryDate.includes("-")) {
      const parts = expiryDate.split("-").map(Number);
      expiryYear = parts[0];
      expiryMonth = parts[1];
      expiryDay = parts[2] || 0;
    } else if (expiryDate.includes("/")) {
      const parts = expiryDate.split("/").map(Number);
      if (parts.length === 2) {
        expiryMonth = parts[0];
        expiryYear = parts[1] < 100 ? parts[1] + 2000 : parts[1];
      } else {
        expiryDay = parts[0];
        expiryMonth = parts[1];
        expiryYear = parts[2] < 100 ? parts[2] + 2000 : parts[2];
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expDate = new Date(expiryYear, expiryMonth - 1, expiryDay || 1);
    expDate.setHours(0, 0, 0, 0);

    if (!expiryDay) {
      const lastDayOfMonth = new Date(expiryYear, expiryMonth, 0);
      lastDayOfMonth.setHours(23, 59, 59, 999);
      if (lastDayOfMonth < today) {
        toast.error(
          "La fecha de caducidad no puede ser menor a la fecha actual",
        );
        return;
      }
    } else if (expDate < today) {
      toast.error("La fecha de caducidad no puede ser menor a la fecha actual");
      return;
    }

    const parsedQty = parseInt(quantityPerPiece, 10);
    if (!quantityPerPiece || isNaN(parsedQty) || parsedQty <= 0) {
      toast.error("La cantidad por pieza debe ser mayor a 0");
      return;
    }

    // Buscar ID en el catálogo maestro
    const matchedMedicine = catalogItems.find(
      (item) =>
        (barcode && item.codigo_barras === barcode) ||
        (ssa && item.clave_ssa === ssa) ||
        (medicineName &&
          item.medicamento.toLowerCase() === medicineName.toLowerCase()),
    );

    const newItem: IncomingItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      medicineId: matchedMedicine?.id || ssa,
      name: medicineName.trim(),
      ssa: ssa.trim(),
      lote: lotNumber.trim(),
      caducidad: expiryDate,
      quantity: parsedQty,
      barcode: barcode.trim(),
    };

    setIncomingItems((prev) => [...prev, newItem]);

    // Reset inputs
    setMedicineName("");
    setSsa("");
    setQuantityPerPiece("1");
    setExpiryDate("");
    setLotNumber("");
    setBarcode("");
  };

  // Borra el medicamento de la lista de incomingItems
  const handleRemove = (id: string) => {
    setIncomingItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Busca en catalogo_maestro si existe el medicamento por código de barras
  const searchMedication = (code: string) => {
    if (!code) return;

    const medicine = catalogItems.find((item) => item.codigo_barras === code);

    if (medicine) {
      setMedicineName(medicine.medicamento);
      setSsa(medicine.clave_ssa);
      setQuantityPerPiece((medicine.cantidadPorPieza || 1).toString());
    } else {
      toast.error("No se encontró el medicamento con ese código de barras");
    }
  };

  // Confirmar y guardar concentrado en Inventario local (Dexie) y remoto (Supabase)
  const handleConfirm = async () => {
    const targetClinicaId = user?.clinicaId ?? selectedClinicaId;

    if (!targetClinicaId) {
      toast.error(
        "Debes seleccionar una clínica de destino para el inventario.",
      );
      return;
    }

    if (incomingItems.length === 0) {
      toast.warning("No hay medicamentos en la lista para ingresar.");
      setIsConfirmOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const entries = incomingItems.map((item) => ({
        id_clinica: targetClinicaId,
        id_medicamento: item.medicineId || item.ssa,
        lote: item.lote,
        stock: item.quantity,
        fecha_caducidad: item.caducidad,
        medicamento: item.name,
        clave_ssa: item.ssa,
        codigo_barras: item.barcode,
      }));

      // 1. Guardar en Dexie y Supabase Inventario
      await inventarioRepository.addEntries(entries);

      // 2. Disparar sincronización
      triggerSync().catch(() => {});

      const totalPiezas = incomingItems.reduce((acc, i) => acc + i.quantity, 0);
      toast.success(
        `Se registraron ${totalPiezas} piezas en el inventario de ${assignedClinica?.nombre || "la clínica"}.`,
      );

      // 3. Limpiar estado y cerrar modal
      setIncomingItems([]);
      setIsConfirmOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al registrar el inventario";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto max-h-screen">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Entrada de Insumos
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Registra el ingreso de medicamentos y suministros al almacén
        </p>
      </div>

      {/* Formulario de Captura */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Código de Barras
            </label>
            <Input
              disabled={searchByData}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  searchMedication(barcode);
                }
              }}
              placeholder="Ingrese el código de barras..."
              required
            />
          </div>
          <div className="pt-5">
            <Button
              variant={"secondary"}
              type="button"
              onClick={() => {
                setSearchByData(!searchByData);
                if (searchByData) {
                  setMedicineName("");
                  setSsa("");
                  setQuantityPerPiece("1");
                  setExpiryDate("");
                  setLotNumber("");
                  setBarcode("");
                }
              }}
              className="w-full h-10"
            >
              <Search className="w-4 h-4" />
              <span>
                {searchByData
                  ? "Buscar por código de barras"
                  : "Buscar por datos"}
              </span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre del Medicamento
            </label>
            <Select
              value={medicineName}
              onValueChange={(value) => {
                const medicine = catalogItems.find(
                  (item) => item.medicamento === value,
                );
                if (medicine) {
                  setMedicineName(medicine.medicamento);
                  setSsa(medicine.clave_ssa);
                  setBarcode(medicine.codigo_barras);
                }
              }}
              disabled={!searchByData}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un medicamento" />
              </SelectTrigger>
              <SelectContent>
                {catalogItems.map((item) => (
                  <SelectItem key={item.id} value={item.medicamento}>
                    {item.medicamento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              SSA
            </label>
            <Input
              readOnly
              disabled
              type="text"
              value={ssa}
              onChange={(e) => setSsa(e.target.value)}
              placeholder="010.000.0000.00"
            />
          </div>
        </div>

        <form onSubmit={handleAddItem} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cantidad por Pieza
              </label>
              <Input
                type="number"
                min="1"
                value={quantityPerPiece}
                onChange={(e) => setQuantityPerPiece(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Fecha de Caducidad
              </label>
              <Input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Número de Lote
              </label>
              <Input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Ej. AH224"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full h-10">
              <Plus className="w-4 h-4" />
              <span>AÑADIR A LISTA</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Lista de Insumos Pendientes de Ingresar */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Insumos en lista ({incomingItems.length})
        </h2>

        {incomingItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white/50">
            No hay insumos pendientes de ingresar. Llena el formulario superior.
          </div>
        ) : (
          <ScrollArea className="flex-1 h-[calc(100vh-39rem)]" type="auto">
            {incomingItems.map((item) => (
              <div
                key={item.id}
                className="m-3 bg-[#fffdf5] border border-amber-200/70 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-800 m-0">
                    {item.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>
                      SSA:{" "}
                      <strong className="text-slate-700 font-mono">
                        {item.ssa}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      CANTIDAD:{" "}
                      <strong className="text-slate-700">
                        {item.quantity} piezas
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-amber-800 font-medium">
                    LOTE Y CADUCIDAD:{" "}
                    <span className="font-mono">{item.lote}</span> | Cad:{" "}
                    {item.caducidad}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemove(item.id)}
                    title="Eliminar insumo"
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </div>

      {/* Barra de Acciones Final */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <div className="text-xs text-slate-500 font-medium">
          Total por ingresar:{" "}
          <strong className="text-slate-800">
            {incomingItems.reduce((acc, i) => acc + i.quantity, 0)} piezas
          </strong>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (incomingItems.length > 0) {
                setIncomingItems([]);
                toast.info("Se canceló la lista de insumos.");
              }
            }}
            disabled={incomingItems.length === 0}
            className="flex-1 sm:flex-none gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Cancelar</span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              if (incomingItems.length === 0) {
                toast.warning("No hay medicamentos en la lista para ingresar.");
                return;
              }
              setIsConfirmOpen(true);
            }}
            disabled={incomingItems.length === 0}
            className="flex-1 sm:flex-none gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            <Check className="w-4 h-4" />
            <span>Ingresar medicamentos</span>
          </Button>
        </div>
      </Card>

      {/* Diálogo de Confirmación y Concentrado */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg font-bold text-slate-800">
              <PackageCheck className="w-5 h-5 text-blue-600" />
              <span>Confirmar Entrada de Insumos</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verifica el concentrado de insumos médicos que se ingresarán al
              inventario local y a la base de datos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tarjeta de Clínica Destino */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Clínica Destino
                    </span>
                    {user?.clinicaId ? (
                      <span className="text-xs font-bold text-slate-800">
                        {assignedClinica?.nombre ||
                          user?.clinicaNombre ||
                          `Clínica #${user.clinicaId}`}
                      </span>
                    ) : (
                      <div className="mt-1">
                        <select
                          value={selectedClinicaId ?? ""}
                          onChange={(e) =>
                            setSelectedClinicaId(Number(e.target.value))
                          }
                          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">
                            Selecciona la clínica de destino...
                          </option>
                          {clinicas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} {c.clues ? `(${c.clues})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {user?.clinicaId ? (
                  <Badge className="bg-blue-600 text-white text-[10px] self-start sm:self-center">
                    Asignada en tu perfil
                  </Badge>
                ) : (
                  <span className="text-[11px] text-amber-600 font-medium self-start sm:self-center">
                    Selección manual (Admin)
                  </span>
                )}
              </div>
            </div>

            {/* Resumen de totales */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Insumos Distintos
                </span>
                <span className="text-base font-extrabold text-blue-700">
                  {incomingItems.length} tipos
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total de Piezas
                </span>
                <span className="text-base font-extrabold text-emerald-700">
                  {incomingItems.reduce((acc, i) => acc + i.quantity, 0)} piezas
                </span>
              </div>
            </div>

            {/* Tabla del concentrado */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Detalle del Concentrado
              </p>
              <ScrollArea className="max-h-56 border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100/70 sticky top-0">
                    <TableRow>
                      <TableHead className="text-[11px] font-bold text-slate-700">
                        Medicamento
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700">
                        Clave SSA
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700">
                        Lote
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700">
                        Caducidad
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 text-right">
                        Cantidad
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomingItems.map((item) => (
                      <TableRow
                        key={item.id}
                        className="text-xs hover:bg-slate-50/60"
                      >
                        <TableCell className="font-semibold text-slate-800">
                          {item.name}
                        </TableCell>
                        <TableCell className="font-mono text-slate-500 text-[11px]">
                          {item.ssa}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-slate-700">
                          {item.lote}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {item.caducidad}
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-blue-600">
                          {item.quantity} pzas
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || !(user?.clinicaId ?? selectedClinicaId)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Ingresar</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
