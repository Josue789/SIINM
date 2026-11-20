import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  ChevronRight,
  LoaderCircle,
  Building2,
  Package,
  Layers,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  FileArchive,
  X,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useNetwork } from "@/context/NetworkContext";
import { inventarioRepository } from "@/db/repositories/inventario.repository";
import { clinicaRepository } from "@/db/repositories/clinica.repository";
import type { Clinica } from "@/types/inventory.types";
import {
  getInventoryExportData,
  exportToExcel,
  exportToPdf,
  exportToSyncGz,
  validateSyncGzFile,
  importSyncPackageToSupabase,
  type ExportInventoryItem,
  type SyncPackageEnvelope,
  type ImportSyncResult,
} from "@/services/export/exportService";
import { toast } from "react-toastify";

export const ExportPage: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, triggerSync } = useNetwork();

  const [syncWithServer, setSyncWithServer] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [clinics, setClinics] = useState<Clinica[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<number>(() => {
    return user?.clinicaId ? Number(user.clinicaId) : 0;
  });
  const [previewItems, setPreviewItems] = useState<ExportInventoryItem[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Estados para importación de archivo .sync.gz
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidatingFile, setIsValidatingFile] = useState(false);
  const [validatedPackage, setValidatedPackage] =
    useState<SyncPackageEnvelope | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "accumulate">(
    "replace",
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportSyncResult | null>(
    null,
  );

  // Cargar lista de clínicas para administradores
  useEffect(() => {
    let isMounted = true;
    const loadClinics = async () => {
      try {
        const data = await clinicaRepository.getAll();
        if (isMounted) {
          setClinics(data);
        }
      } catch (err) {
        console.warn("No se pudieron obtener las clínicas de Supabase:", err);
      }
    };

    if (user?.role === "admin") {
      loadClinics();
    }
  }, [user?.role]);

  // Cargar resumen de items que serán exportados
  const refreshPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const filterClinic =
        selectedClinicId > 0
          ? selectedClinicId
          : user?.clinicaId
            ? Number(user.clinicaId)
            : null;
      const items = await getInventoryExportData(filterClinic);
      setPreviewItems(items);
    } catch (err) {
      console.error("Error cargando preview de inventario:", err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClinicId, user?.clinicaId]);

  // Determinar el nombre de la clínica a imprimir en los reportes
  const activeClinicName = (() => {
    if (selectedClinicId > 0) {
      const found = clinics.find((c) => c.id === selectedClinicId);
      if (found) return found.nombre;
    }
    if (user?.clinicaNombre) return user.clinicaNombre;
    if (user?.clinicaId && clinics.length > 0) {
      const found = clinics.find((c) => c.id === Number(user.clinicaId));
      if (found) return found.nombre;
    }
    return "Todas las Clínicas";
  })();

  const totalStockCount = previewItems.reduce(
    (acc, curr) => acc + (curr.stock || 0),
    0,
  );

  const exportOptions = [
    {
      id: "pdf",
      title: "Descarga inventario en formato PDF",
      format: "Documento PDF (.pdf)",
      description:
        "Reporte oficial estructurado y paginado en orientación horizontal con sellos de fecha.",
      icon: FileText,
      color: "text-red-600 bg-red-50 group-hover:bg-red-100",
    },
    {
      id: "excel",
      title: "Descarga inventario en formato Excel",
      format: "Libro de Excel (.xlsx)",
      description:
        "Hoja de cálculo estilizada con autofiltros, semáforo de caducidades y fórmulas de totales.",
      icon: FileSpreadsheet,
      color: "text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100",
    },
    {
      id: "sync_gz",
      title: "Descarga paquete seguro de sincronización",
      format: "Archivo comprimido y firmado (.sync.gz)",
      description:
        "Paquete comprimido con GZIP y firma criptográfica SHA-256 para transporte seguro e importación a Supabase.",
      icon: ShieldCheck,
      color: "text-blue-600 bg-blue-50 group-hover:bg-blue-100",
    },
  ];

  const handleExport = async (formatId: string) => {
    if (exportingFormat) return;
    setExportingFormat(formatId);

    try {
      // 1. Sincronizar si está activado
      if (syncWithServer) {
        if (isOnline) {
          try {
            await inventarioRepository.pushUnsyncedLocal();
            const clinicToSync =
              selectedClinicId > 0
                ? selectedClinicId
                : user?.clinicaId
                  ? Number(user.clinicaId)
                  : undefined;
            await inventarioRepository.pullFromRemote(clinicToSync);
            await triggerSync(true);
          } catch (syncErr) {
            console.warn(
              "Aviso durante sincronización antes de exportar:",
              syncErr,
            );
          }
        } else {
          toast.info(
            "Sin conexión a Internet: exportando con los datos locales guardados.",
          );
        }
      }

      // 2. Obtener datos actualizados del inventario
      const filterClinic =
        selectedClinicId > 0
          ? selectedClinicId
          : user?.clinicaId
            ? Number(user.clinicaId)
            : null;
      const items = await getInventoryExportData(filterClinic);

      if (items.length === 0) {
        toast.warn(
          "No hay registros de inventario disponibles para exportar en este momento.",
        );
        setExportingFormat(null);
        return;
      }

      // 3. Opciones comunes para el reporte
      const options = {
        clinicId: filterClinic,
        clinicName: activeClinicName,
        userName: user?.fullName || user?.email || "Personal de Farmacia",
        generatedAt: new Date(),
      };

      // 4. Generar según el formato seleccionado
      if (formatId === "excel") {
        await exportToExcel(items, options);
        toast.success(
          "Reporte en formato Excel (.xlsx) generado y descargado.",
        );
      } else if (formatId === "pdf") {
        await exportToPdf(items, options);
        toast.success("Reporte en formato PDF (.pdf) generado y descargado.");
      } else if (formatId === "sync_gz") {
        await exportToSyncGz(items, options);
        toast.success(
          "Paquete seguro (.sync.gz) firmado y descargado correctamente.",
        );
      }
    } catch (err) {
      console.error("Error generando exportación:", err);
      const message =
        err instanceof Error ? err.message : "Error al generar el reporte";
      toast.error(`No se pudo generar la exportación: ${message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleSelectFile = async (file: File | null) => {
    setImportResult(null);
    setValidationError(null);
    setValidatedPackage(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setIsValidatingFile(true);

    try {
      const envelope = await validateSyncGzFile(file);
      setValidatedPackage(envelope);
      toast.success(
        "Archivo .sync.gz verificado: firma SHA-256 e integridad válidas.",
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Archivo .sync.gz inválido o corrupto.";
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setIsValidatingFile(false);
    }
  };

  const handleClearImport = () => {
    setSelectedFile(null);
    setValidatedPackage(null);
    setValidationError(null);
    setImportResult(null);
    setImportProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportToSupabase = async () => {
    if (!validatedPackage || isImporting) return;

    if (!isOnline) {
      toast.error(
        "Necesitas conexión a Internet para importar y actualizar en Supabase.",
      );
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setImportProgress({ processed: 0, total: validatedPackage.items.length });

    try {
      const fallbackClinic =
        selectedClinicId > 0
          ? selectedClinicId
          : user?.clinicaId
            ? Number(user.clinicaId)
            : null;

      const result = await importSyncPackageToSupabase(validatedPackage, {
        fallbackClinicId: fallbackClinic,
        mode: importMode,
        onProgress: (processed, total) => {
          setImportProgress({ processed, total });
        },
      });

      setImportResult(result);
      await refreshPreview();
      await triggerSync(true);

      if (result.skipped === 0) {
        toast.success(
          `Importación completada en Supabase: ${result.inserted} nuevos, ${result.updated} actualizados.`,
        );
      } else {
        toast.warn(
          `Importación finalizada con avisos: ${result.inserted} nuevos, ${result.updated} actualizados, ${result.skipped} omitidos.`,
        );
      }
    } catch (err) {
      console.error("Error al importar paquete .sync.gz a Supabase:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Error al sincronizar con Supabase";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Título de la página */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide uppercase m-0">
          Exportar Inventario
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Descarga los datos del inventario actual en una de las diferentes
          opciones para compartir
        </p>
      </div>

      {/* Switch sincronización con servidor */}
      <Card className="p-4 flex items-center justify-between shadow-xs border-slate-200">
        <div>
          <p className="text-xs font-bold text-slate-700 m-0">
            Sincronizar con servidor antes de exportar
          </p>
          <p className="text-[11px] text-slate-400 m-0">
            {syncWithServer
              ? "Asegura tener los datos más actualizados de la nube antes de generar el archivo"
              : "Se exportarán inmediatamente los datos locales sin consultar la red"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSyncWithServer(!syncWithServer)}
          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
            syncWithServer ? "bg-blue-600" : "bg-slate-300"
          }`}
          aria-label="Alternar sincronización antes de exportar"
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              syncWithServer ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </Card>

      {/* Panel de Resumen de Inventario a exportar */}
      <Card className="p-4 bg-slate-50/70 border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100/70 text-blue-700">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Unidad a exportar
              </span>
              {user?.role === "admin" && clinics.length > 0 ? (
                <div className="mt-0.5">
                  <select
                    value={selectedClinicId}
                    onChange={(e) =>
                      setSelectedClinicId(Number(e.target.value))
                    }
                    className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value={0}>Todas las Clínicas (Consolidado)</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-800 m-0">
                  {activeClinicName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 sm:border-l sm:border-slate-200 sm:pl-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] font-medium text-slate-400 block leading-tight">
                  Insumos
                </span>
                <span className="text-xs font-black text-slate-700">
                  {isLoadingPreview ? "..." : previewItems.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] font-medium text-slate-400 block leading-tight">
                  Piezas totales
                </span>
                <span className="text-xs font-black text-slate-700">
                  {isLoadingPreview
                    ? "..."
                    : totalStockCount.toLocaleString("en-US")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Opciones de Descarga */}
      <div className="space-y-3">
        {exportOptions.map((opt) => {
          const Icon = opt.icon;
          const isCurrentlyExporting = exportingFormat === opt.id;

          return (
            <Card
              key={opt.id}
              onClick={() => handleExport(opt.id)}
              className={`p-4 transition-all group text-left border-slate-200 shadow-xs ${
                exportingFormat && !isCurrentlyExporting
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:bg-slate-50/80 hover:border-slate-300 cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl transition-colors ${opt.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 m-0 group-hover:text-blue-600 transition-colors">
                      {opt.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 m-0">
                      {opt.format}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 m-0 hidden sm:block">
                      {opt.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isCurrentlyExporting ? (
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold">Generando...</span>
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sección de Importación y Validación de Paquetes .sync.gz hacia Supabase */}
      {user?.role !== "Personal" && (
        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-800 tracking-wide uppercase m-0">
                Importar Paquete de Sincronización (.sync.gz)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 m-0">
                Valida la integridad criptográfica de un archivo .sync.gz y
                actualiza las existencias en Supabase
              </p>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Conectado a Supabase</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Sin Internet (Requerido para importar)</span>
                </>
              )}
            </div>
          </div>

          <Card className="p-5 border-slate-200 shadow-xs space-y-4">
            {!isOnline && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold m-0">Conexión a Internet requerida</p>
                  <p className="text-amber-700 mt-0.5 m-0">
                    Puedes seleccionar y validar la firma de seguridad de un
                    archivo <code>.sync.gz</code> sin red, pero la
                    sincronización hacia Supabase únicamente se habilitará
                    cuando tengas conexión a Internet.
                  </p>
                </div>
              </div>
            )}

            {/* Selector de archivo .sync.gz */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".gz,.sync.gz,application/gzip,application/x-gzip"
              onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) handleSelectFile(dropped);
                }}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 transition-all rounded-xl p-6 text-center cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-700 m-0">
                  Haz clic para seleccionar o arrastra un archivo{" "}
                  <span className="text-blue-600">.sync.gz</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 m-0">
                  Se verificará automáticamente la compresión GZIP, el esquema
                  de datos y la firma SHA-256
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Barra del archivo seleccionado */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                      <FileArchive className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate m-0">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-400 m-0">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearImport}
                    disabled={isImporting}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
                    title="Quitar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Estado de validación */}
                {isValidatingFile && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">
                    <LoaderCircle className="w-4 h-4 animate-spin shrink-0" />
                    <span>
                      Descomprimiendo GZIP y verificando firma criptográfica
                      SHA-256...
                    </span>
                  </div>
                )}

                {validationError && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold m-0">
                        Validación de seguridad rechazada
                      </p>
                      <p className="text-red-700 mt-0.5 m-0">
                        {validationError}
                      </p>
                    </div>
                  </div>
                )}

                {/* Resumen del paquete validado */}
                {validatedPackage && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold">
                            Paquete auténtico e íntegro (Firma SHA-256
                            verificada)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                          SHA-256: {validatedPackage.integrityHash.slice(0, 16)}
                          ...
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-emerald-200/70">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">
                            Unidad Origen
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {validatedPackage.metadata.clinicName}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">
                            Exportado por
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {validatedPackage.metadata.exportedBy}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">
                            Lotes / Insumos
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            {validatedPackage.metadata.recordCount} registros
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-700/70 block">
                            Total Piezas
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            {validatedPackage.metadata.totalStock.toLocaleString(
                              "en-US",
                            )}{" "}
                            pzas
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Modo de sincronización */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <p className="text-xs font-bold text-slate-700 m-0">
                          Modo de actualización en Supabase
                        </p>
                        <p className="text-[11px] text-slate-500 m-0">
                          {importMode === "replace"
                            ? "Reemplaza el stock de cada lote con el valor del archivo e inserta lotes nuevos."
                            : "Suma las cantidades del archivo al stock ya existente en Supabase."}
                        </p>
                      </div>
                      <select
                        value={importMode}
                        onChange={(e) =>
                          setImportMode(
                            e.target.value as "replace" | "accumulate",
                          )
                        }
                        disabled={isImporting}
                        className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="replace">
                          Sincronizar existencias (Reemplazar stock)
                        </option>
                        <option value="accumulate">
                          Acumular existencias (Sumar al stock)
                        </option>
                      </select>
                    </div>

                    {/* Progreso de importación */}
                    {isImporting && importProgress && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-blue-700">
                          <span>Actualizando registros en Supabase...</span>
                          <span>
                            {importProgress.processed} / {importProgress.total}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-200"
                            style={{
                              width: `${Math.round(
                                (importProgress.processed /
                                  Math.max(1, importProgress.total)) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Resultado de la importación */}
                    {importResult && (
                      <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs space-y-2">
                        <p className="font-bold text-blue-900 m-0">
                          Resultado de sincronización con Supabase:
                        </p>
                        <div className="flex flex-wrap gap-4 text-slate-700">
                          <span>
                            <strong className="text-emerald-700">
                              {importResult.inserted}
                            </strong>{" "}
                            lotes nuevos insertados
                          </span>
                          <span>
                            <strong className="text-blue-700">
                              {importResult.updated}
                            </strong>{" "}
                            lotes actualizados
                          </span>
                          {importResult.skipped > 0 && (
                            <span>
                              <strong className="text-amber-700">
                                {importResult.skipped}
                              </strong>{" "}
                              omitidos
                            </span>
                          )}
                        </div>
                        {importResult.errors.length > 0 && (
                          <ul className="text-[11px] text-amber-800 list-disc pl-4 space-y-0.5 max-h-28 overflow-y-auto m-0 pt-1">
                            {importResult.errors.map((errMsg, idx) => (
                              <li key={idx}>{errMsg}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Botón de acción */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleImportToSupabase}
                        disabled={!isOnline || isImporting}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          !isOnline || isImporting
                            ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer"
                        }`}
                      >
                        {isImporting ? (
                          <>
                            <LoaderCircle className="w-4 h-4 animate-spin" />
                            <span>Sincronizando con Supabase...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            <span>Validar y Actualizar en Supabase</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
