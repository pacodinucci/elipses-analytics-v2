// src/viewer/ui/hooks/use-viewer.ts
import * as React from "react";
import type { HeatmapStyle } from "../../../store/heatmap-style";

type MapaData = {
  grid: (number | null)[][];
  xEdges?: number[];
  yEdges?: number[];
  // legacy soportado
  x_edges?: number[];
  y_edges?: number[];
};

type NormalizedMapaData = {
  grid: (number | null)[][];
  xEdges: number[];
  yEdges: number[];
};

function getGridRange(grid: (number | null)[][]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of grid) {
    for (const v of row) {
      if (v == null || Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  return { min, max };
}

function computeDataRange(
  style: HeatmapStyle,
  gridMin: number,
  gridMax: number,
): { dataMin: number; dataMax: number } {
  if (style.valueRangeMode === "auto") {
    return { dataMin: gridMin, dataMax: gridMax };
  }

  if (style.customStops.length > 0) {
    const values = style.customStops.map((s) => s.value);
    return { dataMin: Math.min(...values), dataMax: Math.max(...values) };
  }

  return { dataMin: gridMin, dataMax: gridMax };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

// ✅ helper sin any para leer edges soportando xEdges/yEdges o x_edges/y_edges
function normalizeEdges(raw: MapaData): { xEdges: number[]; yEdges: number[] } {
  const xEdgesUnknown = (raw.xEdges ?? raw.x_edges) as unknown;
  const yEdgesUnknown = (raw.yEdges ?? raw.y_edges) as unknown;

  if (!Array.isArray(xEdgesUnknown) || !Array.isArray(yEdgesUnknown)) {
    throw new Error("Mapa inválido: faltan xEdges/yEdges (o x_edges/y_edges).");
  }

  return {
    xEdges: xEdgesUnknown as number[],
    yEdges: yEdgesUnknown as number[],
  };
}

export type UseViewerMapaArgs = {
  // ✅ v2: necesitamos proyectoId para resolver capaId
  proyectoId: string | null;

  // UI (todavía pasa nombre)
  capa: string | null;

  // por ahora no lo usamos para map lookup (porque el mapa es 1:1 por capa)
  variable: string;

  heatmapStyle: HeatmapStyle;
};

export function useViewerMapa({
  proyectoId,
  capa,
  variable,
  heatmapStyle,
}: UseViewerMapaArgs) {
  const [data, setData] = React.useState<NormalizedMapaData | null>(null);
  const [loading, setLoading] = React.useState(false);

  // ⚠️ error real (input inválido, json corrupto, etc.)
  const [error, setError] = React.useState<string | null>(null);

  // ✅ estado “no hay mapa”
  const [mapaMissing, setMapaMissing] = React.useState(false);

  const [gridMinMax, setGridMinMax] = React.useState<{
    min: number;
    max: number;
  }>({ min: 0, max: 1 });

  React.useEffect(() => {
    let alive = true;

    // gating
    if (!proyectoId || !capa) {
      setData(null);
      setError(null);
      setMapaMissing(false);
      setLoading(false);
      return;
    }

    if (!window.electron?.coreCapaListByProject) {
      setError("IPC no disponible: window.electron.coreCapaListByProject()");
      setData(null);
      setMapaMissing(false);
      setLoading(false);
      return;
    }

    if (!window.electron?.legacyVisualizerGetMap) {
      setError("IPC no disponible: window.electron.legacyVisualizerGetMap()");
      setData(null);
      setMapaMissing(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMapaMissing(false);
    setData(null);

    (async () => {
      try {
        // 1) resolver capaId por proyectoId + nombre de capa
        const capas = await window.electron.coreCapaListByProject({
          proyectoId,
        });

        const needle = normalizeName(capa);
        const found = (capas ?? []).find(
          (c: any) => normalizeName(String(c?.nombre ?? "")) === needle,
        );

        if (!found?.id) {
          if (!alive) return;
          // si la capa no existe, no es “map missing”; es input inválido del UI
          setError(`No se encontró la capa "${capa}" en el proyecto.`);
          setMapaMissing(false);
          setData(null);
          return;
        }

        const capaId = String(found.id);

        // 2) pedir mapa (legacy adapter) por capaId
        const legacy = await window.electron.legacyVisualizerGetMap({ capaId });

        if (!alive) return;

        // si no hay mapa, NO es error: es “missing”
        if (!legacy) {
          setData(null);
          setError(null);
          setMapaMissing(true);
          return;
        }

        // 3) normalizar payload a MapaData
        // Nota: el legacy adapter puede devolver nombres distintos; mantenemos robusto.
        const raw: MapaData = {
          grid: (legacy as any).grid,
          xEdges: (legacy as any).xEdges,
          yEdges: (legacy as any).yEdges,
          x_edges: (legacy as any).x_edges,
          y_edges: (legacy as any).y_edges,
        };

        const { xEdges, yEdges } = normalizeEdges(raw);

        const grid = raw.grid as (number | null)[][] | undefined;
        if (!Array.isArray(grid)) {
          throw new Error("Mapa inválido: falta grid");
        }

        const normalized: NormalizedMapaData = {
          grid,
          xEdges,
          yEdges,
        };

        setData(normalized);
        setMapaMissing(false);
        setGridMinMax(getGridRange(grid));
      } catch (err) {
        console.error("Error cargando mapa (useViewerMapa v2):", err);
        if (!alive) return;

        setError(err instanceof Error ? err.message : String(err));
        setData(null);
        setMapaMissing(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // variable no participa del lookup (mapa 1:1 capa), pero si querés que recargue por variable, dejalo
  }, [proyectoId, capa, variable]);

  const { dataMin, dataMax } = React.useMemo(
    () => computeDataRange(heatmapStyle, gridMinMax.min, gridMinMax.max),
    [heatmapStyle, gridMinMax.min, gridMinMax.max],
  );

  return { data, loading, error, mapaMissing, dataMin, dataMax };
}
