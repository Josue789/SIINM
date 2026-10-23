import React, { useState } from "react";
import { Barcode, Trash2, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export const PrescriptionsPage: React.FC = () => {
  const [recipeFolio, setRecipeFolio] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  //Lista de medicamentos
  const [medications, setMedications] = useState([
    {
      name: "Pentoxifilina tablets",
      lote: "PENT-12345",
      caducidad: "12/2025",
      quantity: 10,
      stock: 100,
      ssa: "123456",
      barcode: "123456",
      id: "1",
    },
    {
      name: "Ibuprofeno tablets",
      lote: "IBUP-56789",
      caducidad: "06/2026",
      quantity: 5,
      stock: 75,
      ssa: "654321",
      barcode: "778945",
      id: "2",
    },
    {
      name: "Paracetamol solution",
      lote: "PARA-11223",
      caducidad: "11/2024",
      quantity: 3,
      stock: 120,
      ssa: "333444",
      barcode: "234567",
      id: "3",
    },
    {
      name: "Amoxicillin caps",
      lote: "AMOX-99887",
      caducidad: "03/2027",
      quantity: 8,
      stock: 90,
      ssa: "777888",
      barcode: "556789",
      id: "4",
    },
    {
      name: "Captopril tablets",
      lote: "CAP-45654",
      caducidad: "01/2025",
      quantity: 2,
      stock: 110,
      ssa: "999000",
      barcode: "445678",
      id: "5",
    },
  ]);

  // Medicamentos agregados
  const [addedItems, setAddedItems] = useState([]);

  const handleRemoveItem = (id: string) => {
    setAddedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setAddedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  };

  const handleAddItem = (item: any) => {
    const exists = addedItems.find((i) => i.id === item.id);
    if (exists) {
      handleUpdateQuantity(item.id, 1);
      return;
    }
    setAddedItems((prev) => [...prev, { ...item, quantity: 1 }]);
  };

  const filteredMedications = medications.filter((item) =>
    search ? item.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  const item = medications.find(
                    (item) => item.barcode === barcodeInput,
                  );
                  if (item) {
                    handleAddItem(item);
                    setBarcodeInput("");
                  }
                }
              }}
              placeholder="Escanee o escriba el código del medicamento..."
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0"
              title="Escanear código de barras"
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
          <Card className="p-8 text-center text-slate-400 text-xs">
            No hay insumos en la lista aún. Escanea un código para agregar.
          </Card>
        ) : (
          <div className="space-y-3">
            {addedItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#fffdf5] border border-amber-200/70 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
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
          </div>
        )}
      </div>

      {/* Barra de Acciones Final según Figma Desktop - 1 */}
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

          <Button type="button" className="flex-1 sm:flex-none gap-1.5">
            <Check className="w-4 h-4" />
            <span>Surtir receta</span>
          </Button>
        </div>
      </Card>

      {/* Dialog de busqueda de medicamentos */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Lista de medicamentos</DialogTitle>
          <DialogDescription>
            <p>Busca el medicamento que deseas agregar a la receta</p>
            <Input
              placeholder="Buscar medicamento"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              className="my-4"
              suffix={<Search className="w-4 h-4 text-slate-400" />}
            />
            {filteredMedications.map((item) => (
              <Card
                onClick={() => {
                  handleAddItem(item);
                  setOpen(false);
                }}
                key={item.id}
                className="bg-[#fdfdfd]  rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs mb-2"
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
              </Card>
            ))}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};
