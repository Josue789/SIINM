import React, { useEffect, useMemo, useState } from "react";
import { Trash2, Check, X, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { inventarioRepository } from "@/db/repositories/inventario.repository";
import { catalogoMedicamentoRepository } from "@/db/repositories/catalogoMedicamento.repository";
import { useAuth } from "@/context/AuthContext";
import { useNetwork } from "@/context/NetworkContext";
import { toast } from "react-toastify";
import { DialogClose } from "@radix-ui/react-dialog";

interface PrescriptionMedication {
  id: string;
  name: string;
  lote: string;
  caducidad: string;
  quantity: number;
  stock: number;
  ssa: string;
  barcode: string;
}

interface GroupedMedication {
  key: string;
  name: string;
  ssa: string;
  totalStock: number;
  barcodes: string[];
  batches: PrescriptionMedication[];
}

/**
 * Convierte cualquier formato de fecha de caducidad (YYYY-MM-DD, MM/YYYY, MM/YY, DD/MM/YYYY, ISO)
 * a timestamp numérico para poder ordenar de forma ascendente (la fecha más próxima a vencer primero).
 */
const parseExpirationDate = (expiryDate?: string): number => {
  if (
    !expiryDate ||
    typeof expiryDate !== "string" ||
    expiryDate.trim() === "" ||
    expiryDate.toUpperCase() === "N/A"
  ) {
    return Infinity;
  }

  const clean = expiryDate.trim();

  // Formato ISO
  if (clean.includes("T")) {
    const t = new Date(clean).getTime();
    if (!isNaN(t)) return t;
  }

  // Formatos con guión '-'
  if (clean.includes("-")) {
    const parts = clean.split("-").map(Number);
    if (parts.length === 3) {
      if (parts[0] > 1000) {
        // YYYY-MM-DD
        const [year, month, day] = parts;
        return new Date(year, month - 1, day).getTime();
      } else {
        // DD-MM-YYYY
        const [day, month, year] = parts;
        const fullYear = year < 100 ? year + 2000 : year;
        return new Date(fullYear, month - 1, day).getTime();
      }
    } else if (parts.length === 2) {
      if (parts[0] > 1000) {
        // YYYY-MM
        const [year, month] = parts;
        return new Date(year, month, 0).getTime();
      } else {
        // MM-YYYY
        const [month, year] = parts;
        const fullYear = year < 100 ? year + 2000 : year;
        return new Date(fullYear, month, 0).getTime();
      }
    }
  }

  // Formatos con barra '/'
  if (clean.includes("/")) {
    const parts = clean.split("/").map(Number);
    if (parts.length === 2) {
      // MM/YY o MM/YYYY -> vence al final del mes indicado
      const month = parts[0];
      const year = parts[1] < 100 ? parts[1] + 2000 : parts[1];
      return new Date(year, month, 0).getTime();
    } else if (parts.length === 3) {
      if (parts[0] > 1000) {
        // YYYY/MM/DD
        const [year, month, day] = parts;
        return new Date(year, month - 1, day).getTime();
      } else {
        // DD/MM/YYYY o DD/MM/YY
        const [day, month, rawYear] = parts;
        const year = rawYear < 100 ? rawYear + 2000 : rawYear;
        return new Date(year, month - 1, day).getTime();
      }
    }
  }

  const fallback = new Date(clean).getTime();
  return isNaN(fallback) ? Infinity : fallback;
};

/**
 * Obtiene la clave única para agrupar medicamentos por Clave SSA o Nombre
 */
const getMedicationGroupKey = (med: {
  ssa?: string;
  name?: string;
  id?: string;
}) => {
  const ssa = (med.ssa || "").trim().toUpperCase();
  if (ssa) return `ssa:${ssa}`;
  const name = (med.name || "").trim().toUpperCase();
  if (name) return `name:${name}`;
  return `id:${med.id}`;
};

export const PrescriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const { triggerSync } = useNetwork();

  const [recipeFolio, setRecipeFolio] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Lista completa de todos los lotes en inventario
  const [medicationList, setMedicationList] = useState<
    PrescriptionMedication[]
  >([]);

  // Medicamentos/lotes agregados para surtir
  const [addedItems, setAddedItems] = useState<PrescriptionMedication[]>([]);

  // Procesamiento de información para traer datos de inventario
  const loadData = async () => {
    if (!user?.clinicaId) return;

    // Llama de la base de datos los medicamentos solo de la clínica del usuario
    const medications = await inventarioRepository.getByClinica(user.clinicaId);

    // Opcionalmente enriquece con el catálogo local para códigos de barra o claves SSA faltantes
    const catalogMap = new Map<
      string,
      { clave_ssa?: string; codigo_barras?: string; medicamento?: string }
    >();
    try {
      const catalog = await catalogoMedicamentoRepository.getAll();
      for (const cat of catalog) {
        if (cat.id) catalogMap.set(String(cat.id), cat);
        if (cat.clave_ssa) {
          catalogMap.set(cat.clave_ssa.trim().toUpperCase(), cat);
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar el catálogo de medicamentos", e);
    }

    const formatted: PrescriptionMedication[] = medications.map((med) => {
      const ssaKey = (med.clave_ssa || "").trim().toUpperCase();
      const catInfo =
        catalogMap.get(String(med.id_medicamento)) ||
        (ssaKey ? catalogMap.get(ssaKey) : undefined);

      return {
        id: String(med.id ?? ""),
        name:
          med.medicamento || catInfo?.medicamento || "Medicamento sin nombre",
        lote: med.lote || "S/L",
        caducidad: med.fecha_caducidad || "N/A",
        quantity: 1,
        stock: Number(med.stock) || 0,
        ssa: med.clave_ssa || catInfo?.clave_ssa || "",
        barcode: med.codigo_barras || catInfo?.codigo_barras || "",
      };
    });

    setMedicationList(formatted);
  };

  // Cargar lista de inventario
  useEffect(() => {
    loadData();
  }, [user?.clinicaId]);

  // Agrupar medicamentos únicos por Clave SSA o Nombre (una sola vez sin duplicados)
  const groupedMedications = useMemo<GroupedMedication[]>(() => {
    const groupsMap = new Map<string, GroupedMedication>();

    for (const item of medicationList) {
      const key = getMedicationGroupKey(item);

      const existing = groupsMap.get(key);
      if (!existing) {
        groupsMap.set(key, {
          key,
          name: item.name,
          ssa: item.ssa,
          totalStock: item.stock,
          barcodes: item.barcode ? [item.barcode] : [],
          batches: [item],
        });
      } else {
        existing.totalStock += item.stock;
        if (item.barcode && !existing.barcodes.includes(item.barcode)) {
          existing.barcodes.push(item.barcode);
        }
        existing.batches.push(item);
      }
    }

    // Ordenar los lotes de cada medicamento por fecha de caducidad más próxima (FEFO)
    for (const group of groupsMap.values()) {
      group.batches.sort(
        (a, b) =>
          parseExpirationDate(a.caducidad) - parseExpirationDate(b.caducidad),
      );
    }

    // Ordenar alfabéticamente por nombre
    return Array.from(groupsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [medicationList]);

  // Filtrar la lista del buscador por Nombre, Clave SSA o Código de Barras
  const filteredMedications = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return groupedMedications;

    return groupedMedications.filter((group) => {
      const matchName = group.name.toLowerCase().includes(trimmed);
      const matchSsa = group.ssa.toLowerCase().includes(trimmed);
      const matchBarcode = group.barcodes.some((bc) =>
        bc.toLowerCase().includes(trimmed),
      );
      return matchName || matchSsa || matchBarcode;
    });
  }, [groupedMedications, search]);

  const handleRemoveItem = (id: string) => {
    setAddedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setAddedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty < 1) return item;
          if (delta > 0 && item.stock > 0 && newQty > item.stock) {
            toast.warning(
              `Stock máximo disponible alcanzado para el lote ${item.lote} (${item.stock} piezas)`,
            );
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  };

  /**
   * Al agregar un medicamento, busca automáticamente el lote con fecha de vencimiento
   * más próxima que aún cuente con stock disponible (FEFO).
   */
  const handleAddMedicationGroup = (group: GroupedMedication) => {
    if (!group.batches || group.batches.length === 0) {
      toast.error("No se encontraron lotes para este medicamento.");
      return;
    }

    // Buscar el lote con fecha de caducidad más próxima que tenga stock restante
    const availableBatch = group.batches.find((batch) => {
      if (batch.stock <= 0) return false;
      const inAdded = addedItems.find((item) => item.id === batch.id);
      const currentQty = inAdded ? inAdded.quantity : 0;
      return currentQty < batch.stock;
    });

    if (availableBatch) {
      const exists = addedItems.find((item) => item.id === availableBatch.id);
      if (exists) {
        handleUpdateQuantity(availableBatch.id, 1);
      } else {
        setAddedItems((prev) => [...prev, { ...availableBatch, quantity: 1 }]);
      }
      return;
    }

    // Si ningún lote tiene stock disponible restante
    if (group.totalStock <= 0) {
      toast.warning(
        `El medicamento "${group.name}" no cuenta con existencias disponibles en inventario.`,
      );
      return;
    }

    toast.warning(
      `Se ha alcanzado el stock total disponible (${group.totalStock} piezas) para "${group.name}".`,
    );
  };

  /**
   * Maneja el escaneo o ingreso directo de código de barras / clave SSA desde el input principal
   */
  const handleBarcodeScan = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;

    // Buscar en grupos por código de barras
    const matchedGroup = groupedMedications.find((group) =>
      group.barcodes.some((bc) => bc.trim().toLowerCase() === trimmed),
    );

    if (matchedGroup) {
      handleAddMedicationGroup(matchedGroup);
      setBarcodeInput("");
      return;
    }

    // Buscar en grupos por clave SSA
    const matchedBySsa = groupedMedications.find(
      (group) => group.ssa.trim().toLowerCase() === trimmed,
    );

    if (matchedBySsa) {
      handleAddMedicationGroup(matchedBySsa);
      setBarcodeInput("");
      return;
    }

    toast.error(`No se encontró ningún medicamento con el código: ${code}`);
  };

  // Abre cuadro de dialogo con resumen de medicamentos
  const handleSubmit = () => {
    if (addedItems.length === 0) {
      toast.warning("Agregue al menos un medicamento a la receta.");
      return;
    }

    if (!recipeFolio.trim()) {
      toast.warning("Ingrese el folio de la receta.");
      return;
    }

    setIsConfirmOpen(true);
  };

  /**
   * Valida y surte la receta, descontando de la base de datos los medicamentos utilizados.
   *
   */
  const handleConfirmRecipe = async () => {
    setLoading(true);

    try {
      // 1. Validar que existan items
      if (addedItems.length === 0) {
        toast.warning("Agregue al menos un medicamento a la receta.");
        return;
      }

      // 2. Validar folio de receta
      if (!recipeFolio.trim()) {
        toast.warning("Ingrese el folio de la receta.");
        return;
      }

      // 3. Validar que no se repitan lotes
      const hasDuplicateBatches = addedItems.some(
        (item, index) =>
          addedItems.findIndex((i) => i.id === item.id) !== index,
      );
      if (hasDuplicateBatches) {
        toast.warning("No se permiten lotes duplicados.");
        return;
      }

      // 4. Ejecutar actualización descontando las cantidades surtidas
      await Promise.all(
        addedItems.map((item) =>
          inventarioRepository.updateStock({
            recordId: item.id,
            quantityDispensed: item.quantity,
            reason: `Receta médica - Folio ${recipeFolio}`,
          }),
        ),
      );

      // Disparar sincronización con Supabase en segundo plano si hay conexión
      triggerSync().catch(() => {});

      // 5. Refrescar datos de inventario y limpiar formulario
      await loadData();
      setAddedItems([]);
      setRecipeFolio("");
      setBarcodeInput("");
      toast.success("Receta surtida exitosamente");

      setIsConfirmOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(
        "Error al surtir la receta: " +
          (error instanceof Error ? error.message : "Error desconocido"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto max-h-[calc(100vh-5rem)]">
      {/* Título de la pantalla */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Surtimiento de Recetas
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Escanea el código de barras o ingresa el folio para surtir
          medicamentos
        </p>
      </div>

      {/* Formulario superior: Folio y Lectura de Código de barras */}
      <Card className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Folio de Receta
          </label>
          <Input
            type="text"
            value={recipeFolio}
            onChange={(e) => setRecipeFolio(e.target.value)}
            placeholder="Ingrese el número de folio de la receta"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Lectura de Insumo / Código de Barras
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBarcodeScan(barcodeInput);
                }
              }}
              placeholder="Escanee o escriba el código de barras o clave SSA..."
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0"
              title="Buscar medicamento en lista"
              onClick={() => setOpen(true)}
            >
              <Search className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Sección Insumos Agregados */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Insumos Agregados
        </h2>

        {addedItems.length === 0 ? (
          <Card className="p-8 text-center text-slate-400 text-xs h-[calc(100vh-30rem)] flex items-center justify-center">
            No hay insumos en la lista aún. Escanea un código o busca un
            medicamento para agregar.
          </Card>
        ) : (
          <ScrollArea type="auto" className="flex-1 h-[calc(100vh-30rem)]">
            {addedItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#fffdf5] border border-amber-200/70 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs mb-3 mr-5"
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
                      STOCK:{" "}
                      <strong className="text-slate-700">
                        {item.stock} piezas
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-amber-800 font-medium flex items-center gap-2">
                    <span>LOTE Y CADUCIDAD:</span>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs bg-white text-slate-700"
                    >
                      {item.lote}
                    </Badge>
                    <span>Cad: {item.caducidad}</span>
                  </div>
                </div>

                {/* Contador de cantidad y botón eliminar */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-xs font-bold text-slate-800 min-w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveItem(item.id)}
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
          Total de insumos a surtir:{" "}
          <strong className="text-slate-800">
            {addedItems.reduce((acc, i) => acc + i.quantity, 0)} unidades
          </strong>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setAddedItems([])}
            className="flex-1 sm:flex-none gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Cancelar</span>
          </Button>

          <Button
            type="button"
            className="flex-1 sm:flex-none gap-1.5"
            onClick={() => handleSubmit()}
            disabled={addedItems.length === 0 || loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Surtir receta</span>
          </Button>
        </div>
      </Card>

      {/* Dialog confirmacion de entrega de medicamento */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="w-full max-w-4xl sm:min-w-[48rem] sm:max-h-[40rem] min-h-[60vh] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Confirmar entrega</DialogTitle>
            <DialogDescription className="py-4 text-sm font-semibold">
              Verifica que se esta entregando la cantidad y lote correcto de
              cada medicamento
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[35rem]">
            {addedItems.map((item) => (
              <Card
                key={item.id}
                className="py-2 px-4 flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs bg-white text-slate-700"
                    >
                      {item.lote}
                    </Badge>
                    <span>Cad: {item.caducidad}</span>
                  </div>
                </div>
                <span className="font-semibold text-slate-800">
                  {item.quantity}
                </span>
              </Card>
            ))}
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button disabled={loading} onClick={handleConfirmRecipe}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Confirmar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de búsqueda de medicamentos sin duplicados */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-4xl sm:min-w-[48rem] sm:max-h-[40rem] min-h-[60vh] max-h-[80vh]">
          <DialogTitle>Lista de medicamentos</DialogTitle>
          <DialogDescription>
            Busca el medicamento por nombre, clave SSA o código de barras
          </DialogDescription>
          <div className="relative my-4">
            <Input
              placeholder="Buscar por nombre, clave SSA o código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredMedications.length === 1) {
                  e.preventDefault();
                  handleAddMedicationGroup(filteredMedications[0]);
                  setOpen(false);
                  setSearch("");
                }
              }}
              className="pr-10"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <ScrollArea
            type="auto"
            className="flex-1 overflow-y-auto h-[calc(100vh-20rem)]"
          >
            {filteredMedications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No se encontraron medicamentos disponibles
              </div>
            ) : (
              filteredMedications.map((item) => (
                <Card
                  onClick={() => {
                    handleAddMedicationGroup(item);
                    setOpen(false);
                    setSearch("");
                  }}
                  key={item.key}
                  className="bg-[#fdfdfd] hover:bg-slate-50 transition-colors cursor-pointer rounded-2xl p-4 mr-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs mb-2"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 m-0">
                      {item.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>
                        SSA:{" "}
                        <strong className="text-slate-700 font-mono">
                          {item.ssa || "Sin clave"}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        STOCK:{" "}
                        <strong className="text-slate-700">
                          {item.totalStock} piezas
                        </strong>
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
