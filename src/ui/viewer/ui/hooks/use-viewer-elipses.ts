// src/viewer/ui/hooks/use-viewer-elipses.ts
import * as React from "react";
import type { ElipseRow } from "../../engine/layers/elipses/ellipses-polygons-layer";
import { useViewerElipsesStore } from "../../../store/viewer-elipses-store";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

type Args = {
  /**
   * ✅ v2: todo cuelga del proyecto.
   * compat: si todavía te llega "yacimientoId", tratamos que sea proyectoId operativo.
   */
  proyectoId?: string | null;
  yacimientoId?: string | null; // deprecated compat

  capa: string | null;
};

export function useViewerElipses({
  proyectoId = null,
  yacimientoId = null,
  capa,
}: Args) {
  const byCapa = useViewerElipsesStore((s) => s.byCapa);
  const loading = useViewerElipsesStore((s) => s.loading);
  const error = useViewerElipsesStore((s) => s.error);

  // ✅ id operativo (por ahora) — mientras el flujo real use simulacionId
  const storeProyectoId = useViewerElipsesStore((s) => s.proyectoId);
  const isReady = useViewerElipsesStore((s) => s.isReady());

  const key = React.useMemo(() => (capa ? normalizeName(capa) : null), [capa]);

  const elipses: ElipseRow[] = React.useMemo(() => {
    if (!key) return [];
    return byCapa[key] ?? [];
  }, [byCapa, key]);

  const ctxProyectoId = proyectoId ?? yacimientoId ?? null;

  React.useEffect(() => {
    if (!key) return;
    if (!isReady) return;

    // si te pasaron un proyectoId distinto al que está cargado en el store,
    // devolvemos vacío silenciosamente (evita mezclar data vieja).
    if (ctxProyectoId && storeProyectoId && ctxProyectoId !== storeProyectoId) {
      console.warn("[useViewerElipses] proyectoId mismatch (compat)", {
        asked: ctxProyectoId,
        store: storeProyectoId,
      });
      return;
    }

    console.log("[useViewerElipses] from store", {
      key,
      count: elipses.length,
    });
  }, [key, isReady, ctxProyectoId, storeProyectoId, elipses.length]);

  const safeElipses =
    ctxProyectoId && storeProyectoId && ctxProyectoId !== storeProyectoId
      ? []
      : elipses;

  return {
    elipses: safeElipses,
    loading,
    error,
  };
}
