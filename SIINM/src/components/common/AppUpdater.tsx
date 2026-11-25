import React, { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "react-toastify";
import { DownloadCloud, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ENV } from "@/config/env";

export const CHECK_UPDATES_EVENT = "siinm:check-updates";

export function triggerManualUpdateCheck(): void {
  window.dispatchEvent(new CustomEvent(CHECK_UPDATES_EVENT));
}

export const AppUpdater: React.FC = () => {
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const checkingRef = useRef(false);

  const checkForUpdates = useCallback(async (manual: boolean) => {
    if (!isTauri() || checkingRef.current) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (manual) {
        toast.info("Conéctate a Internet para buscar actualizaciones.");
      }
      return;
    }

    checkingRef.current = true;
    try {
      const update = await check();
      if (update) {
        setAvailableUpdate((prev) => {
          if (prev && prev !== update) {
            prev.close().catch(() => null);
          }
          return update;
        });
        setProgressPercent(null);
        setStatusMessage("");
        setDialogOpen(true);
      } else if (manual) {
        toast.success(`${ENV.APP_NAME} ya está en la versión más reciente.`);
      }
    } catch (err) {
      console.warn("[AppUpdater] Error al buscar actualizaciones:", err);
      if (manual) {
        toast.error("No se pudo verificar si hay actualizaciones disponibles.");
      }
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const timer = window.setTimeout(() => {
      void checkForUpdates(false);
    }, 3000);

    const onManualCheck = () => {
      void checkForUpdates(true);
    };

    window.addEventListener(CHECK_UPDATES_EVENT, onManualCheck);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CHECK_UPDATES_EVENT, onManualCheck);
    };
  }, [checkForUpdates]);

  const handleInstall = async () => {
    if (!availableUpdate || isDownloading) return;

    setIsDownloading(true);
    setProgressPercent(0);
    setStatusMessage("Descargando actualización...");

    let totalBytes = 0;
    let downloadedBytes = 0;

    try {
      await availableUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            downloadedBytes = 0;
            setProgressPercent(totalBytes > 0 ? 0 : null);
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              setProgressPercent(
                Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
              );
            }
            break;
          case "Finished":
            setProgressPercent(100);
            setStatusMessage("Instalando y reiniciando aplicación...");
            break;
        }
      });

      await relaunch();
    } catch (err) {
      console.error("[AppUpdater] Error al instalar la actualización:", err);
      setIsDownloading(false);
      setStatusMessage("");
      toast.error("Ocurrió un error al descargar o instalar la actualización.");
    }
  };

  if (!isTauri() || !availableUpdate) {
    return null;
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!isDownloading) {
          setDialogOpen(open);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80">
              <DownloadCloud className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Nueva actualización disponible</DialogTitle>
              <DialogDescription>
                {ENV.APP_NAME} v{availableUpdate.version} (actual: v
                {availableUpdate.currentVersion})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {availableUpdate.body && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-wrap">
            {availableUpdate.body}
          </div>
        )}

        {isDownloading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                {statusMessage || "Descargando..."}
              </span>
              {progressPercent !== null && (
                <span className="font-semibold text-blue-700">
                  {progressPercent}%
                </span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${progressPercent ?? 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isDownloading}
            onClick={() => setDialogOpen(false)}
          >
            Más tarde
          </Button>
          <Button
            type="button"
            disabled={isDownloading}
            onClick={handleInstall}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Actualizar y reiniciar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
