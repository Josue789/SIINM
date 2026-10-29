import React, { useEffect, useState } from "react";
import { Search, Building2, MoreVertical, Pencil, Trash2 } from "lucide-react";
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

export const SupervisionPage: React.FC = () => {
  const [selectedClinic, setSelectedClinic] = useState<number>(0);
  const [search, setSearch] = useState("");

  const [clinicsData, setClinicsData] = useState<Clinica[]>([]);
  const [inventarios, setInventarios] = useState<InventarioItem[]>([]);

  useEffect(() => {
    const fetchClinicsList = async () => {
      try {
        const response = await clinicaRepository.getAll();
        setClinicsData(response);
        setSelectedClinic(response[0].id);
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
    fetchClinicsList();
    fetchClinicsData();
  }, []);

  const filteredData = inventarios.filter((item) => {
    const searchMatch =
      item.medicamento.toLowerCase().includes(search.toLowerCase()) ||
      item.clave_ssa.toLowerCase().includes(search.toLowerCase()) ||
      item.lote.toLowerCase().includes(search.toLowerCase());
    const clinicMatch = selectedClinic
      .toString()
      .includes(item.id_clinica.toString());
    return searchMatch && clinicMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Supervisión de Clínicas
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitoreo consolidado de inventarios por unidad y clínica médica
        </p>
      </div>

      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Filtrar Medicamentos:
          </span>
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
            {filteredData.map((item) => (
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
                      new Date(item.fecha_caducidad) >
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        ? "default"
                        : "destructive"
                    }
                  >
                    {item.fecha_caducidad}
                  </Badge>
                </TableCell>
                <TableCell className="font-bold text-slate-800">
                  {item.stock}
                </TableCell>
                <TableCell className="flex justify-center items-center">
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
                      <DropdownMenuItem className="cursor-pointer text-slate-700 ">
                        <Pencil className="w-4 h-4 mr-2 " />
                        Ajustar Cantidad
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-red-700 ">
                        <Trash2 className="w-4 h-4 mr-2 " />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
