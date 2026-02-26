// src/viewer/ui/hooks/use-viewer-bubbles.ts
import * as React from "react";
import type {
  BubblePoint,
  BubblePieKey,
  BubbleRenderMode,
} from "../../engine/layers/bubbles/bubbles-layer";
import type { BubbleMetric } from "../../../store/bubbles-style";

type ProduccionRow = {
  id?: string | number | null;

  pozo?: string | null;
  nombre?: string | null;
  well?: string | null;
  wellId?: string | null;

  x?: number | null;
  y?: number | null;

  petroleo?: number | string | null;
  agua?: number | string | null;
  gas?: number | string | null;

  agua_iny?: number | string | null;
  aguaIny?: number | string | null;
  aguaInyectada?: number | string | null;
};

type WellRow = {
  id?: string | number | null;
  pozoId?: string | number | null;
  wellId?: string | number | null;
  nombre?: string | null;
  name?: string | null;
  x?: number | null;
  y?: number | null;
};

type Args = {
  enabled: boolean;

  produccionRows: ProduccionRow[];
  wells: WellRow[];

  selectedDate: string | null;
  capa: string | null;

  // usado SOLO en modo circle (y para compat)
  metric: BubbleMetric;

  // ✅ nuevo: determina cómo construir value + filtros
  renderMode?: BubbleRenderMode;
  pieKeys?: BubblePieKey[];

  debug?: boolean;
};

function n(v: unknown): number {
  if (v == null) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = String(v).trim().replace(",", ".");
  const x = Number(s);
  return Number.isFinite(x) ? x : NaN;
}

function metricValue(row: ProduccionRow, metric: BubbleMetric): number {
  switch (metric) {
    case "petroleo":
      return n(row.petroleo);
    case "agua":
      return n(row.agua);
    case "gas":
      return n(row.gas);
    case "aguaIny":
      return n(row.agua_iny ?? row.aguaIny ?? row.aguaInyectada);
    default:
      return NaN;
  }
}

function buildWellsIndex(wells: WellRow[]) {
  const m = new Map<string, { x: number; y: number; nombre: string }>();

  (wells ?? []).forEach((w) => {
    const id = String(w.id ?? w.pozoId ?? w.wellId ?? "").trim();
    const nombre = String(w.nombre ?? w.name ?? "").trim();

    const x = n(w.x);
    const y = n(w.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const finalName = nombre || id || "—";

    if (id) m.set(id, { x, y, nombre: finalName });
    if (nombre) m.set(nombre, { x, y, nombre: finalName });
  });

  return m;
}

function posValue(v: number): number | undefined {
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

const DEFAULT_PIE_KEYS: BubblePieKey[] = ["petroleo", "agua", "gas", "aguaIny"];

export function useViewerBubbles({
  enabled,
  produccionRows,
  wells,
  selectedDate,
  capa,
  metric,
  renderMode = "circle",
  pieKeys,
  debug = false,
}: Args): BubblePoint[] {
  const wellsIndex = React.useMemo(() => buildWellsIndex(wells ?? []), [wells]);

  const bubbles = React.useMemo<BubblePoint[]>(() => {
    if (!enabled) return [];
    if (!selectedDate || !capa) return [];

    const keys = (pieKeys?.length ? pieKeys : DEFAULT_PIE_KEYS).slice();
    const src = (produccionRows ?? []) as ProduccionRow[];

    return src
      .map((p) => {
        const key = String(
          p.wellId ?? p.id ?? p.pozo ?? p.well ?? p.nombre ?? "",
        ).trim();
        if (!key) return null;

        // coords: primero producción, fallback wellsIndex
        const px = n(p.x);
        const py = n(p.y);
        const w = wellsIndex.get(key);

        const x = Number.isFinite(px) ? px : (w?.x ?? NaN);
        const y = Number.isFinite(py) ? py : (w?.y ?? NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

        // ✅ pie data (siempre)
        const pet = metricValue(p, "petroleo");
        const agu = metricValue(p, "agua");
        const gas = metricValue(p, "gas");
        const iny = metricValue(p, "aguaIny");

        const pie = {
          petroleo: posValue(pet),
          agua: posValue(agu),
          gas: posValue(gas),
          aguaIny: posValue(iny),
        };

        if (renderMode === "pie") {
          // ✅ en pie mode, la burbuja existe si el TOTAL del pie > 0
          const total = keys.reduce((acc, k) => acc + (pie[k] ?? 0), 0);

          if (!Number.isFinite(total) || total <= 0) return null;

          return {
            id: `prod:${key}:${selectedDate}:${capa}`,
            x,
            y,
            value: total, // radio/escala basado en total (por defecto lógico)
            nombre: String(p.nombre ?? p.pozo ?? w?.nombre ?? key),
            pie,
          } as BubblePoint;
        }

        // ✅ circle mode: como antes, filtra por metric
        const value = metricValue(p, metric);
        if (!Number.isFinite(value) || value === 0) return null;

        return {
          id: `prod:${key}:${selectedDate}:${capa}`,
          x,
          y,
          value,
          nombre: String(p.nombre ?? p.pozo ?? w?.nombre ?? key),
          pie,
        } as BubblePoint;
      })
      .filter((b): b is BubblePoint => !!b);
  }, [
    enabled,
    produccionRows,
    wellsIndex,
    selectedDate,
    capa,
    metric,
    renderMode,
    pieKeys,
  ]);

  React.useEffect(() => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.log("[useViewerBubbles]", {
      enabled,
      metric,
      renderMode,
      pieKeys: pieKeys?.length ?? 0,
      produccionRows: produccionRows?.length ?? 0,
      wells: wells?.length ?? 0,
      bubbles: bubbles.length,
      selectedDate,
      capa,
    });
  }, [
    debug,
    enabled,
    metric,
    renderMode,
    pieKeys,
    produccionRows,
    wells,
    bubbles,
    selectedDate,
    capa,
  ]);

  return bubbles;
}
