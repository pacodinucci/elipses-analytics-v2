// src/components/viewer/viewer-floating-window.tsx
import * as React from "react";
import { FloatingWindow } from "../layout/floating-window";
import { Viewer } from "../../viewer/ui/components/viewer";

// ✅ Reutilizamos la misma toolbar del mapa
import { MapaToolbar } from "../mapa/mapa-toolbar";
import { useMapViewOptions } from "../../store/map-view-options";

import { useHeatmapStyle } from "../../store/heatmap-style";
import { useSelectionStore } from "../../store/selection-store";
import { DateTimeline } from "../mapa/date-timeline";
import { TbArrowLeft, TbArrowRight } from "react-icons/tb";

import { useProyectos } from "../../hooks/use-proyectos";

import { useViewerMapa } from "../../viewer/ui/hooks/use-viewer";
import { useViewerWells } from "../../viewer/ui/hooks/use-viewer-wells";
import { useViewerElipses } from "../../viewer/ui/hooks/use-viewer-elipses";

import { MapNavigator } from "../mapa/map-navigator";
import { MapOptionsModal } from "../mapa/map-options-modal";
import { PozosOptionsModal } from "../mapa/pozos-options-modal";
import { ElipsesOptionsTabsModal } from "../mapa/elipses-options-tabs-modal";

// ✅ Store de pozos
import { usePozosStyle } from "../../store/pozos-style";

// ✅ Store de elipses (fuente de verdad, como en Plotly)
import { useElipsesStyle } from "../../store/elipses-style";

// ✅ Hook de normalización (DB)
import { useElipsesNormalization } from "../../hooks/use-elipses-normalization";

// ✅ store que consume DatosMapaFloatingWindow
import { useMapaDisplayStore } from "../../store/mapa-display-store";

import { useViewerBubbles } from "../../viewer/ui/hooks/use-viewer-bubbles";

// ✅ filtros por mapKey (histórico + reglas)
import {
  useMapaElipsesFiltersStore,
  type FilterOp,
} from "../../store/mapa-elipses-filters-store";

// ✅ Tipos del snapshot
import type { PozoPoint, Elipse as ElipseType } from "../../types/mapa";

// ✅ ENGINE bubbles types
import type { BubblesStyleConfig as EngineBubblesStyleConfig } from "../../viewer/engine/layers/bubbles/bubbles-layer";

// ✅ STORE bubbles types
import { useBubblesStyle } from "../../store/bubbles-style";

import { BubblesOptionsModal } from "../mapa/bubbles-options-modal";

// ✅ NUEVO: producción desde escenarios (v2)
import { useEscenarioProduccionForCapa } from "../../hooks/use-escenario-produccion-for-capa";

type Position = { x: number; y: number };
type Size = { width: number; height: number };

type StoreBubblesStyleConfig = ReturnType<
  typeof useBubblesStyle.getState
>["config"];

type Props = {
  capa?: string | null;

  onClose: () => void;
  initialPosition?: Position;
  initialSize?: Size;
  isActive?: boolean;
  onFocus?: () => void;

  variable?: string; // default "vp"
};

const DEFAULT_VARIABLE = "vp";
const NAV_WIDTH = 224; // w-56

// =========================
// Helpers (fechas / proyecto)
// =========================
function parseIsoDate(dateStr: string): Date | null {
  const s = dateStr.length === 7 ? `${dateStr}-01` : dateStr;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function monthRangeInclusive(start: Date, end: Date): string[] {
  const res: string[] = [];
  const a = new Date(start.getFullYear(), start.getMonth(), 1);
  const b = new Date(end.getFullYear(), end.getMonth(), 1);
  if (a > b) return res;

  const cur = new Date(a);
  while (cur <= b) {
    res.push(toMonthKeyAligned(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return res;

  function toMonthKeyAligned(dd: Date) {
    const yy = dd.getFullYear();
    const mm = String(dd.getMonth() + 1).padStart(2, "0");
    return `${yy}-${mm}`;
  }
}

function toBackendDate(fecha: string | null): string | null {
  if (!fecha) return null;
  const s = String(fecha).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toPozoPoints(wells: any[]): PozoPoint[] {
  if (!Array.isArray(wells)) return [];

  return wells
    .map((w): PozoPoint | null => {
      if (!w) return null;

      if (
        typeof w.id === "string" &&
        typeof w.x === "number" &&
        typeof w.y === "number" &&
        typeof w.nombre === "string"
      ) {
        return w as PozoPoint;
      }

      const id = String(
        w.id ?? w.pozoId ?? w.wellId ?? w.nombre ?? w.name ?? "",
      );
      const nombre = String(w.nombre ?? w.name ?? w.wellName ?? w.id ?? "—");

      const x = Number(w.x ?? w.xutm ?? w.x_utm ?? w.X ?? NaN);
      const y = Number(w.y ?? w.yutm ?? w.y_utm ?? w.Y ?? NaN);

      let estado: any = w.estado ?? w.status ?? w.tipo ?? w.type ?? null;
      if (typeof estado === "string") {
        const ss = estado.toLowerCase();
        if (ss.includes("iny")) estado = 2;
        else if (ss.includes("prod")) estado = 1;
        else if (ss.includes("cerr") || ss.includes("shut")) estado = 0;
        else estado = 3;
      }
      if (typeof estado !== "number") estado = 3;

      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      return { id, nombre, x, y, estado } as PozoPoint;
    })
    .filter((p): p is PozoPoint => p !== null);
}

// =========================
// Helpers (filtros de elipses)
// =========================
function parseRuleNumber(raw: string): number | null {
  const s = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isValidValue(v: unknown): v is number {
  // válido si es finito y distinto de 0
  return typeof v === "number" && Number.isFinite(v) && v !== 0;
}

/**
 * Valor efectivo por fecha:
 * - si showHistorical=false: valor directo en fecha (si es válido)
 * - si showHistorical=true: último valor válido (≠0) con date <= fecha
 */
function getEffectiveValueForDate(
  e: any,
  varName: string,
  fecha: string | null,
  showHistorical: boolean,
): number | null {
  if (!fecha) return null;
  const vars = e?.variables as Record<string, Record<string, any>> | undefined;
  if (!vars) return null;

  const map = vars[varName];
  if (!map) return null;

  if (!showHistorical) {
    const v = map[fecha];
    return isValidValue(v) ? v : null;
  }

  const direct = map[fecha];
  if (isValidValue(direct)) return direct;

  let bestDate: string | null = null;
  let bestValue: number | null = null;

  for (const k in map) {
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    if (k > fecha) continue;
    const v = map[k];
    if (!isValidValue(v)) continue;

    if (bestDate == null || k > bestDate) {
      bestDate = k;
      bestValue = v;
    }
  }

  return bestValue;
}

function compareOp(op: FilterOp, a: number, b: number): boolean {
  switch (op) {
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case "=":
      return a === b;
    case "!=":
      return a !== b;
    default:
      return false;
  }
}

export function ViewerFloatingWindow({
  capa = null,
  onClose,
  initialPosition = { x: 80, y: 80 },
  initialSize = { width: 900, height: 600 },
  isActive = false,
  onFocus,
  variable = DEFAULT_VARIABLE,
}: Props) {
  // ✅ HeatmapStyle store
  const heatmapStore: any = useHeatmapStyle();
  const heatmapStyle = heatmapStore.heatmapStyle;
  const setHeatmapStyle =
    heatmapStore.setHeatmapStyle ?? heatmapStore.setHeatmapStyleState;
  const resetHeatmapStyle =
    heatmapStore.reset ?? heatmapStore.resetHeatmapStyle ?? null;

  // ✅ Pozos style store
  const pozosStore: any = usePozosStyle();
  const pozosConfig =
    pozosStore.config ?? pozosStore.pozosStyleConfig ?? pozosStore.pozosConfig;
  const setPozosConfig =
    pozosStore.onChangeConfig ??
    pozosStore.setConfig ??
    pozosStore.setPozosStyleConfig ??
    pozosStore.setPozosConfig;
  const resetPozosConfig =
    pozosStore.reset ?? pozosStore.resetPozosStyle ?? pozosStore.resetConfig;

  // ✅ Flags del mapa
  const {
    showMapa,
    showPozos,
    showNavigator,
    showElipses,
    showBubbles,
    toggleNavigator,
    toggleMapa,
    togglePozos,
    toggleElipses,
    toggleBubbles,
  } = useMapViewOptions();

  // ✅ UI: modales
  const [isMapOptionsOpen, setIsMapOptionsOpen] = React.useState(false);
  const [isPozosOptionsOpen, setIsPozosOptionsOpen] = React.useState(false);
  const [isElipsesOptionsOpen, setIsElipsesOptionsOpen] = React.useState(false);
  const [isBubblesOptionsOpen, setIsBubblesOptionsOpen] = React.useState(false);

  // ✅ bubbles store
  const bubblesConfig = useBubblesStyle((s) => s.config);
  const setBubblesConfig = useBubblesStyle((s) => s.setConfig);
  const resetBubblesConfig = useBubblesStyle((s) => s.reset);
  const bubbleMetric = useBubblesStyle((s) => s.metric);
  const setBubblesMetric = useBubblesStyle((s) => s.setMetric);

  const bubblesStoreCfg = useBubblesStyle(
    (s) => s.config,
  ) as StoreBubblesStyleConfig;

  const bubblesEngineCfg: EngineBubblesStyleConfig = React.useMemo(() => {
    const cfg = bubblesStoreCfg as any;

    return {
      ...cfg,
      hideNull: true,
      renderMode: cfg.renderMode ?? "circle",
      pieKeys: cfg.pieKeys?.length
        ? cfg.pieKeys
        : ["petroleo", "agua", "gas", "inyeccionAgua", "inyeccionGas"],
      pieColors: cfg.pieColors ?? {
        petroleo: "#2b2b2b",
        agua: "#2f80ed",
        gas: "#f2c94c",
        inyeccionAgua: "#56ccf2",
        inyeccionGas: "#9b51e0",
      },
      pieMinTotal: Number.isFinite(cfg.pieMinTotal) ? cfg.pieMinTotal : 0,
      pieInnerRadiusRatio: Number.isFinite(cfg.pieInnerRadiusRatio)
        ? cfg.pieInnerRadiusRatio
        : 0,
    };
  }, [bubblesStoreCfg]);

  // ✅ UI: overlay refs toggle
  const [showElipsesReferences, setShowElipsesReferences] =
    React.useState(true);

  // =========================
  // ✅ Selección global (v2)
  // =========================
  const proyectoId = useSelectionStore(
    (s: any) => s.selectedProyectoId ?? null,
  );

  /**
   * v2: elipses dependen de Simulacion
   */
  const simulacionId = useSelectionStore(
    (s: any) => s.selectedSimulacionId ?? null,
  );

  /**
   * v2: producción por Escenario
   */
  const escenarioId = useSelectionStore(
    (s: any) => s.selectedEscenarioId ?? null,
  );

  // ✅ Resolver capaId desde (proyectoId + nombre de capa)
  const [capaId, setCapaId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!proyectoId || !capa) {
        setCapaId(null);
        return;
      }

      try {
        const capas = await window.electron.coreCapaListByProject({
          proyectoId,
        });
        const match =
          capas.find(
            (c) =>
              String((c as any).nombre ?? "").trim() === String(capa).trim(),
          ) ?? null;

        if (!cancelled) setCapaId(match?.id ?? null);
      } catch {
        if (!cancelled) setCapaId(null);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [proyectoId, capa]);

  // ✅ MapaDisplayStore bridge (DatosMapaFloatingWindow)
  const makeKey = useMapaDisplayStore((s) => s.makeKey);
  const setActiveKey = useMapaDisplayStore((s) => s.setActiveKey);
  const upsertDisplayed = useMapaDisplayStore((s) => s.upsert);

  const mapKey = React.useMemo(() => {
    return makeKey({
      proyectoId: proyectoId ?? null,
      capa: capa ?? null,
      variable: variable ?? null,
      simulacionId: simulacionId ?? null,
    } as any);
  }, [makeKey, proyectoId, capa, variable, simulacionId]);

  // ✅ filtros por mapKey
  const ensureFilters = useMapaElipsesFiltersStore((s) => s.ensure);
  const filtersForKey = useMapaElipsesFiltersStore((s) =>
    mapKey ? s.byKey[mapKey] : null,
  );

  React.useEffect(() => {
    if (!mapKey) return;
    ensureFilters(mapKey);
  }, [mapKey, ensureFilters]);

  const showHistorical = filtersForKey?.showHistorical ?? false;
  const ruleRows = filtersForKey?.rows ?? [];

  // =========================
  // 1) Rango de fechas del proyecto (v2)
  // =========================
  const {
    proyectos,
    fetchProyectos,
    loading: proyectosLoading,
    error: proyectosHookError,
  } = useProyectos();

  React.useEffect(() => {
    if (!proyectoId) return;
    if (proyectosLoading) return;
    if (proyectos.length > 0) return;
    fetchProyectos().catch(() => {});
  }, [proyectoId, proyectos.length, proyectosLoading, fetchProyectos]);

  const proyecto = React.useMemo(() => {
    if (!proyectoId) return null;
    return proyectos.find((p) => p.id === proyectoId) ?? null;
  }, [proyectoId, proyectos]);

  const [projectMonths, setProjectMonths] = React.useState<string[]>([]);
  const [projectError, setProjectError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!proyectoId) {
      setProjectMonths([]);
      setProjectError(null);
      return;
    }

    if (proyectosHookError) {
      setProjectMonths([]);
      setProjectError(proyectosHookError);
      return;
    }

    if (proyectosLoading && !proyecto) {
      setProjectMonths([]);
      setProjectError(null);
      return;
    }

    if (!proyecto) {
      setProjectMonths([]);
      setProjectError("Proyecto no disponible en memoria.");
      return;
    }

    // ✅ v2: limitesTemporalDesde / limitesTemporalHasta
    const fi =
      (proyecto as any).limitesTemporalDesde ??
      (proyecto as any).fecha_inicio ??
      null;
    const ff =
      (proyecto as any).limitesTemporalHasta ??
      (proyecto as any).fecha_fin ??
      null;

    if (!fi || !ff) {
      setProjectMonths([]);
      setProjectError(
        "El proyecto debe tener limitesTemporalDesde y limitesTemporalHasta para generar el rango.",
      );
      return;
    }

    const start = parseIsoDate(String(fi));
    const end = parseIsoDate(String(ff));

    if (!start || !end) {
      setProjectMonths([]);
      setProjectError("Formato inválido en límites temporales del proyecto.");
      return;
    }

    setProjectError(null);
    setProjectMonths(monthRangeInclusive(start, end));
  }, [proyectoId, proyecto, proyectosLoading, proyectosHookError]);

  const availableDates = React.useMemo(() => {
    return projectMonths.map((ym) => ({
      value: `${ym}-01`,
      label: (() => {
        const [y, m] = ym.split("-");
        return `1/${m}/${y}`;
      })(),
    }));
  }, [projectMonths]);

  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (availableDates.length === 0) {
      setSelectedDate(null);
      return;
    }

    const values = availableDates.map((o) => o.value);
    const last = values[values.length - 1];

    setSelectedDate((prev) => (prev && values.includes(prev) ? prev : last));
  }, [availableDates]);

  const selectedLabel = selectedDate
    ? (availableDates.find((o) => o.value === selectedDate)?.label ?? "")
    : "";

  const canPrev =
    !!selectedDate &&
    availableDates.findIndex((o) => o.value === selectedDate) > 0;

  const canNext =
    !!selectedDate &&
    availableDates.findIndex((o) => o.value === selectedDate) <
      availableDates.length - 1;

  // =========================
  // 4.5) Producción (v2) — desde escenarios (FUERA del viewer)
  // =========================
  const prod = useEscenarioProduccionForCapa({
    proyectoId: proyectoId ?? null,
    escenarioId: escenarioId ?? null,
    capaId: capaId ?? null,
    fecha: selectedDate ?? null,
  });

  // ✅ mantenemos naming para no tocar el resto del archivo
  const produccionRows = prod.rows as any[];
  const produccionLoading = prod.loading;
  const produccionError = prod.error;

  // =========================
  // 2) Mapa (heatmap) desde hook
  // =========================
  const {
    data: mapaData,
    loading: mapaLoading,
    error: mapaError,
    mapaMissing,
    dataMin,
    dataMax,
  } = useViewerMapa({
    proyectoId: proyectoId ?? null,
    capa: capa ?? null,
    variable,
    heatmapStyle,
  });

  const mapaDataForViewer = React.useMemo(() => {
    if (!mapaData) return null;

    const xEdges = (mapaData as any).xEdges ?? (mapaData as any).xedges;
    const yEdges = (mapaData as any).yEdges ?? (mapaData as any).yedges;
    const grid = (mapaData as any).grid;

    if (
      !Array.isArray(grid) ||
      !Array.isArray(xEdges) ||
      !Array.isArray(yEdges)
    ) {
      return null;
    }

    return { grid, xEdges, yEdges } as {
      grid: (number | null)[][];
      xEdges: number[];
      yEdges: number[];
    };
  }, [mapaData]);

  // =========================
  // 3) Pozos por fecha/capa/proyecto (v2)
  // =========================
  const { wells, error: wellsError } = useViewerWells({
    proyectoId: proyectoId ?? null,
    capa,
    selectedDate,
  } as any);

  // =========================
  // 4) Elipses (v2: por simulacion + capa)
  // =========================
  const {
    elipses,
    loading: elipsesLoading,
    error: elipsesError,
  } = useViewerElipses({
    proyectoId: proyectoId ?? null,
    simulacionId: simulacionId ?? null,
    capa,
  } as any);

  const elipseVariables = React.useMemo(() => {
    const set = new Set<string>();
    (elipses ?? []).forEach((e: any) => {
      const vars = e?.variables ?? {};
      Object.keys(vars).forEach((k) => set.add(k));
    });
    return Array.from(set).sort();
  }, [elipses]);

  // =========================
  // ✅ Aplicación de reglas (AND)
  // =========================
  const ellipsesForView = React.useMemo(() => {
    const src = ((elipses ?? []) as any[]) ?? [];
    if (!src.length) return src;

    const activeRules = (ruleRows ?? [])
      .map((r) => ({
        id: r.id,
        variable: (r.variable ?? "").trim(),
        op: r.op as FilterOp,
        value: parseRuleNumber(r.value),
      }))
      .filter((r) => !!r.variable && r.value != null);

    if (!activeRules.length) return src;
    if (!selectedDate) return src;

    return src.filter((e) => {
      for (const rule of activeRules) {
        const v = getEffectiveValueForDate(
          e,
          rule.variable,
          selectedDate,
          showHistorical,
        );

        if (v == null) return false;
        if (!compareOp(rule.op, v, rule.value as number)) return false;
      }
      return true;
    });
  }, [elipses, ruleRows, selectedDate, showHistorical]);

  // =========================
  // ✅ Elipses store (FUENTE DE VERDAD)
  // =========================
  const {
    elipsesStyle,
    setElipsesStyle,

    normalizationScope,

    fillNormalizationScope,
    setFillNormalizationScope,

    axisNormalizationScope,
    setAxisNormalizationScope,

    contourNormalizationScope,
    setContourNormalizationScope,

    fillOpacityVariable,
    setFillOpacityVariable,

    fillColorVariable,
    setFillColorVariable,

    contourLinkChannels,
    setContourLinkChannels,

    contourOpacityVariable,
    setContourOpacityVariable,

    contourWidthVariable,
    setContourWidthVariable,

    contourColorVariable,
    setContourColorVariable,

    axisLinkChannels,
    axisOpacityVariable,
    axisWidthVariable,
    axisColorVariable,
    setAxisLinkChannels,
    setAxisOpacityVariable,
    setAxisWidthVariable,
    setAxisColorVariable,

    sanitizeVariables,

    normalizationRanges,
    normalizationContext,
    setNormalizationRanges,
    clearNormalizationRanges,

    fillNormalizationRanges,
    fillNormalizationContext,
    setFillNormalizationRanges,
    clearFillNormalizationRanges,

    axisNormalizationRanges,
    axisNormalizationContext,
    setAxisNormalizationRanges,
    clearAxisNormalizationRanges,

    contourNormalizationRanges,
    contourNormalizationContext,
    setContourNormalizationRanges,
    clearContourNormalizationRanges,
  } = useElipsesStyle();

  React.useEffect(() => {
    sanitizeVariables(elipseVariables);
  }, [elipseVariables, sanitizeVariables]);

  const hasMapa = !!mapaData && !mapaLoading && !mapaError && !mapaMissing;

  const gridMin = Number.isFinite(dataMin as any) ? (dataMin as number) : 0;
  const gridMax = Number.isFinite(dataMax as any) ? (dataMax as number) : 1;

  const handleResetMapOptions = () => {
    if (typeof resetHeatmapStyle === "function") {
      resetHeatmapStyle();
      return;
    }
    console.warn(
      "[ViewerFloatingWindow] No reset method found in heatmap-style store.",
    );
  };

  const handleResetPozosOptions = () => {
    if (typeof resetPozosConfig === "function") {
      resetPozosConfig();
      return;
    }
    console.warn(
      "[ViewerFloatingWindow] No reset method found in pozos-style store.",
    );
  };

  // =========================
  // 5) Normalización (DB) - v2
  // =========================
  const backendFecha = React.useMemo(
    () => toBackendDate(selectedDate),
    [selectedDate],
  );

  const normGlobal = useElipsesNormalization({
    proyectoId: proyectoId ?? null,
    simulacionId: simulacionId ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: normalizationScope,
  } as any);

  React.useEffect(() => {
    clearNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, simulacionId, capa, backendFecha, normalizationScope]);

  React.useEffect(() => {
    if (normGlobal.loading) return;
    if (normGlobal.error) return;
    if (!proyectoId) return;

    setNormalizationRanges(normGlobal.ranges ?? {}, {
      scope: normalizationScope,
      proyectoId: proyectoId ?? null,
      simulacionId: simulacionId ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    } as any);
  }, [
    normGlobal.loading,
    normGlobal.error,
    normGlobal.ranges,
    setNormalizationRanges,
    normalizationScope,
    proyectoId,
    simulacionId,
    capa,
    backendFecha,
  ]);

  const normFill = useElipsesNormalization({
    proyectoId: proyectoId ?? null,
    simulacionId: simulacionId ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: fillNormalizationScope,
  } as any);

  React.useEffect(() => {
    clearFillNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, simulacionId, capa, backendFecha, fillNormalizationScope]);

  React.useEffect(() => {
    if (normFill.loading) return;
    if (normFill.error) return;
    if (!proyectoId) return;

    setFillNormalizationRanges(normFill.ranges ?? {}, {
      scope: fillNormalizationScope,
      proyectoId: proyectoId ?? null,
      simulacionId: simulacionId ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    } as any);
  }, [
    normFill.loading,
    normFill.error,
    normFill.ranges,
    setFillNormalizationRanges,
    fillNormalizationScope,
    proyectoId,
    simulacionId,
    capa,
    backendFecha,
  ]);

  const normContour = useElipsesNormalization({
    proyectoId: proyectoId ?? null,
    simulacionId: simulacionId ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: contourNormalizationScope,
  } as any);

  React.useEffect(() => {
    clearContourNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, simulacionId, capa, backendFecha, contourNormalizationScope]);

  React.useEffect(() => {
    if (normContour.loading) return;
    if (normContour.error) return;
    if (!proyectoId) return;

    setContourNormalizationRanges(normContour.ranges ?? {}, {
      scope: contourNormalizationScope,
      proyectoId: proyectoId ?? null,
      simulacionId: simulacionId ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    } as any);
  }, [
    normContour.loading,
    normContour.error,
    normContour.ranges,
    setContourNormalizationRanges,
    contourNormalizationScope,
    proyectoId,
    simulacionId,
    capa,
    backendFecha,
  ]);

  const normAxis = useElipsesNormalization({
    proyectoId: proyectoId ?? null,
    simulacionId: simulacionId ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: axisNormalizationScope,
  } as any);

  React.useEffect(() => {
    clearAxisNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, simulacionId, capa, backendFecha, axisNormalizationScope]);

  React.useEffect(() => {
    if (normAxis.loading) return;
    if (normAxis.error) return;
    if (!proyectoId) return;

    setAxisNormalizationRanges(normAxis.ranges ?? {}, {
      scope: axisNormalizationScope,
      proyectoId: proyectoId ?? null,
      simulacionId: simulacionId ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    } as any);
  }, [
    normAxis.loading,
    normAxis.error,
    normAxis.ranges,
    setAxisNormalizationRanges,
    axisNormalizationScope,
    proyectoId,
    simulacionId,
    capa,
    backendFecha,
  ]);

  // =========================
  // Snapshot para DatosMapaFloatingWindow
  // =========================
  const pozosSnapshot = React.useMemo<PozoPoint[]>(
    () => toPozoPoints((wells as any[]) ?? []),
    [wells],
  );

  const elipsesSnapshot = React.useMemo<ElipseType[]>(
    () => ellipsesForView as unknown as ElipseType[],
    [ellipsesForView],
  );

  React.useEffect(() => {
    if (!capa) return;

    upsertDisplayed({
      key: mapKey,
      proyectoId: proyectoId ?? null,
      capa,
      variable,
      fecha: selectedDate,

      // ✅ opcionales v2
      simulacionId: simulacionId ?? null,
      escenarioId: escenarioId ?? null,

      showMapa: showMapa && !!mapaData,
      showPozos,
      showElipses,

      pozos: pozosSnapshot,
      elipses: elipsesSnapshot,
      elipseVariables,

      // ✅ producción ahora viene del hook (escenarios)
      produccion: produccionRows,
    } as any);
  }, [
    upsertDisplayed,
    mapKey,
    proyectoId,
    simulacionId,
    escenarioId,
    capa,
    variable,
    selectedDate,
    showMapa,
    showPozos,
    showElipses,
    mapaData,
    pozosSnapshot,
    elipsesSnapshot,
    elipseVariables,
    produccionRows,
  ]);

  const handleFocus = React.useCallback(() => {
    setActiveKey(mapKey);
    onFocus?.();
  }, [setActiveKey, mapKey, onFocus]);

  React.useEffect(() => {
    if (!capa) return;
    if (!isActive) return;
    setActiveKey(mapKey);
  }, [capa, isActive, mapKey, setActiveKey]);

  // =========================
  // ✅ bubbles definitivas vía hook
  // =========================
  const bubbles = useViewerBubbles({
    enabled: bubblesConfig.enabled,
    produccionRows: produccionRows as any,
    wells: wells as any,
    selectedDate,
    capa: capa ?? null,
    metric: bubbleMetric,

    renderMode: bubblesConfig.renderMode ?? "circle",
    pieKeys: bubblesConfig.pieKeys ?? undefined,
  });

  return (
    <FloatingWindow
      title={capa ?? "—"}
      initialPosition={initialPosition}
      initialSize={initialSize}
      onClose={onClose}
      isActive={isActive}
      onFocus={handleFocus}
      extraWidth={showNavigator ? NAV_WIDTH : 0}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!capa ? (
          <div style={{ padding: 12 }}>
            Seleccioná una capa en la barra superior.
          </div>
        ) : (
          <>
            {/* Mensajes */}
            {projectError && (
              <p style={{ margin: "8px 12px", color: "#a00" }}>
                Error cargando proyecto: {projectError}
              </p>
            )}

            {wellsError && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Error cargando pozos: {wellsError}
              </p>
            )}

            {elipsesLoading && (
              <p style={{ margin: "8px 12px", color: "#666" }}>
                Cargando elipses…
              </p>
            )}
            {elipsesError && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Error cargando elipses: {elipsesError}
              </p>
            )}

            {mapaLoading && (
              <p style={{ margin: "8px 12px", color: "#666" }}>
                Cargando mapa…
              </p>
            )}
            {mapaError && !mapaMissing && (
              <p style={{ margin: "8px 12px", color: "#a00" }}>
                Error cargando mapa: {mapaError}
              </p>
            )}

            {produccionLoading && (
              <p style={{ margin: "8px 12px", color: "#666" }}>
                Cargando producción…
                {prod.source === "superficie"
                  ? " (superficie)"
                  : prod.source === "capa"
                    ? " (por capa)"
                    : ""}
              </p>
            )}
            {produccionError && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Error cargando producción: {produccionError}
              </p>
            )}

            {/* Estado de normalización */}
            {!normGlobal.loading && normGlobal.error && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Normalización (scope={normalizationScope}): {normGlobal.error}
              </p>
            )}
            {!normFill.loading && normFill.error && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Normalización (fill, scope={fillNormalizationScope}):{" "}
                {normFill.error}
              </p>
            )}
            {!normContour.loading && normContour.error && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Normalización (contour, scope={contourNormalizationScope}):{" "}
                {normContour.error}
              </p>
            )}
            {!normAxis.loading && normAxis.error && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Normalización (axis, scope={axisNormalizationScope}):{" "}
                {normAxis.error}
              </p>
            )}

            {/* Toolbar + toggle refs */}
            {!projectError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingRight: 10,
                }}
              >
                <MapaToolbar
                  showNavigator={showNavigator}
                  toggleNavigator={toggleNavigator}
                  showMapa={showMapa}
                  toggleMapa={toggleMapa}
                  showPozos={showPozos}
                  togglePozos={togglePozos}
                  showElipses={showElipses}
                  toggleElipses={toggleElipses}
                  showBubbles={showBubbles}
                  toggleBubbles={toggleBubbles}
                  bubbles={bubbles}
                  onOpenBubblesOptions={() => setIsBubblesOptionsOpen(true)}
                  hasMapa={hasMapa}
                  pozos={wells}
                  elipses={elipses}
                  onOpenMapaOptions={() => setIsMapOptionsOpen(true)}
                  onOpenPozoOptions={() => setIsPozosOptionsOpen(true)}
                  onOpenElipsesOptions={() => setIsElipsesOptionsOpen(true)}
                  showElipsesReferences={showElipsesReferences}
                  toggleElipsesReferences={() =>
                    setShowElipsesReferences((v) => !v)
                  }
                />
              </div>
            )}

            {/* ✅ Timeline compacta */}
            {!projectError && availableDates.length > 0 && (
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flex: "0 0 auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#404040ff",
                      backgroundColor: "#ecececff",
                      padding: "4px 12px",
                      borderRadius: "6px",
                    }}
                  >
                    {selectedLabel}
                  </span>

                  <div style={{ marginLeft: 6, display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedDate) return;
                        const idx = availableDates.findIndex(
                          (o) => o.value === selectedDate,
                        );
                        if (idx > 0)
                          setSelectedDate(availableDates[idx - 1].value);
                      }}
                      disabled={!canPrev}
                      aria-label="Mes anterior"
                      style={{
                        width: 28,
                        height: 22,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: canPrev ? "pointer" : "not-allowed",
                        opacity: canPrev ? 1 : 0.5,
                        display: "grid",
                        placeItems: "center",
                        padding: 0,
                        lineHeight: 0,
                      }}
                    >
                      <TbArrowLeft size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedDate) return;
                        const idx = availableDates.findIndex(
                          (o) => o.value === selectedDate,
                        );
                        if (idx >= 0 && idx < availableDates.length - 1) {
                          setSelectedDate(availableDates[idx + 1].value);
                        }
                      }}
                      disabled={!canNext}
                      aria-label="Mes siguiente"
                      style={{
                        width: 28,
                        height: 22,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: canNext ? "pointer" : "not-allowed",
                        opacity: canNext ? 1 : 0.5,
                        display: "grid",
                        placeItems: "center",
                        padding: 0,
                        lineHeight: 0,
                      }}
                    >
                      <TbArrowRight size={12} />
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <DateTimeline
                    options={availableDates}
                    value={selectedDate}
                    onChange={(v) => setSelectedDate(v)}
                  />
                </div>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
              {showNavigator && (
                <div
                  style={{
                    width: NAV_WIDTH,
                    borderLeft: "1px solid #e9e9e9",
                    background: "#fff",
                    overflow: "hidden",
                  }}
                >
                  <MapNavigator
                    showNavigator={showNavigator}
                    showMapa={showMapa}
                    showPozos={showPozos}
                    showElipses={showElipses}
                    toggleMapa={toggleMapa}
                    togglePozos={togglePozos}
                    toggleElipses={toggleElipses}
                    elipseVariables={elipseVariables}
                  />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                {!mapaLoading && !mapaError && (
                  <Viewer
                    mapKey={mapKey}
                    ellipses={showElipses ? (ellipsesForView as any) : []}
                    wells={showPozos ? wells : []}
                    selectedDate={selectedDate}
                    selectedVariable={fillOpacityVariable ?? variable}
                    gridEnabled={heatmapStyle.gridEnabled}
                    gridSpacingX={heatmapStyle.gridSpacingX}
                    gridSpacingY={heatmapStyle.gridSpacingY}
                    mapaMissing={mapaMissing}
                    mapaData={showMapa ? mapaDataForViewer : null}
                    heatmapStyle={heatmapStyle}
                    heatmapDataMin={dataMin}
                    heatmapDataMax={dataMax}
                    colorbarTitle={variable}
                    showElipsesReferences={showElipsesReferences}
                    fillOpacityVar={
                      elipsesStyle.fillEnabled ? fillOpacityVariable : null
                    }
                    fillColorVar={
                      elipsesStyle.fillEnabled &&
                      elipsesStyle.fillColorMode === "variable"
                        ? fillColorVariable
                        : null
                    }
                    axisOpacityVar={
                      elipsesStyle.axisEnabled ? axisOpacityVariable : null
                    }
                    axisColorVar={
                      elipsesStyle.axisEnabled &&
                      elipsesStyle.axisColorMode === "variable"
                        ? axisColorVariable
                        : null
                    }
                    contourOpacityVar={
                      elipsesStyle.contourEnabled
                        ? contourOpacityVariable
                        : null
                    }
                    contourWidthVar={
                      elipsesStyle.contourEnabled ? contourWidthVariable : null
                    }
                    contourColorVar={
                      elipsesStyle.contourEnabled &&
                      elipsesStyle.contourColorMode === "variable"
                        ? contourColorVariable
                        : null
                    }
                    normalizationRanges={normalizationRanges}
                    normalizationScope={normalizationScope}
                    normalizationContext={normalizationContext}
                    fillNormalizationRanges={fillNormalizationRanges}
                    fillNormalizationScope={fillNormalizationScope}
                    fillNormalizationContext={fillNormalizationContext}
                    contourNormalizationRanges={contourNormalizationRanges}
                    contourNormalizationScope={contourNormalizationScope}
                    contourNormalizationContext={contourNormalizationContext}
                    axisNormalizationRanges={axisNormalizationRanges}
                    axisNormalizationScope={axisNormalizationScope}
                    axisNormalizationContext={axisNormalizationContext}
                    bubbles={
                      showBubbles && bubblesConfig.enabled ? bubbles : []
                    }
                    bubblesStyle={bubblesEngineCfg}
                    bubblesMetric={bubbleMetric}
                  />
                )}
              </div>
            </div>

            <MapOptionsModal
              isOpen={isMapOptionsOpen}
              onClose={() => setIsMapOptionsOpen(false)}
              heatmapStyle={heatmapStyle}
              setHeatmapStyle={setHeatmapStyle}
              gridMin={gridMin}
              gridMax={gridMax}
              onReset={handleResetMapOptions}
            />

            <PozosOptionsModal
              isOpen={isPozosOptionsOpen}
              onClose={() => setIsPozosOptionsOpen(false)}
              config={pozosConfig}
              onChangeConfig={setPozosConfig}
              onReset={handleResetPozosOptions}
            />

            <ElipsesOptionsTabsModal
              isOpen={isElipsesOptionsOpen}
              onClose={() => setIsElipsesOptionsOpen(false)}
              elipseVariables={elipseVariables}
              // fill
              fillVariable={fillOpacityVariable}
              onChangeFillVariable={setFillOpacityVariable}
              fillColorVariable={fillColorVariable}
              onChangeFillColorVariable={setFillColorVariable}
              // contour
              contourLinkChannels={contourLinkChannels}
              onChangeContourLinkChannels={setContourLinkChannels}
              contourOpacityVariable={contourOpacityVariable}
              contourWidthVariable={contourWidthVariable}
              contourColorVariable={contourColorVariable}
              onChangeContourOpacityVariable={setContourOpacityVariable}
              onChangeContourWidthVariable={setContourWidthVariable}
              onChangeContourColorVariable={setContourColorVariable}
              // axis
              axisLinkChannels={axisLinkChannels}
              onChangeAxisLinkChannels={setAxisLinkChannels}
              axisOpacityVariable={axisOpacityVariable}
              axisWidthVariable={axisWidthVariable}
              onChangeAxisOpacityVariable={setAxisOpacityVariable}
              onChangeAxisWidthVariable={setAxisWidthVariable}
              axisColorVariable={axisColorVariable}
              onChangeAxisColorVariable={setAxisColorVariable}
              // style
              style={elipsesStyle}
              onChangeStyle={setElipsesStyle}
              // scopes
              fillNormalizationScope={fillNormalizationScope}
              contourNormalizationScope={contourNormalizationScope}
              axisNormalizationScope={axisNormalizationScope}
              onChangeFillNormalizationScope={setFillNormalizationScope}
              onChangeContourNormalizationScope={setContourNormalizationScope}
              onChangeAxisNormalizationScope={setAxisNormalizationScope}
              // context (v2)
              proyectoId={proyectoId ?? null}
              simulacionId={simulacionId ?? null}
              capaNombre={capa ?? null}
              fecha={selectedDate}
            />

            <BubblesOptionsModal
              isOpen={isBubblesOptionsOpen}
              onClose={() => setIsBubblesOptionsOpen(false)}
              metric={bubbleMetric}
              onChangeMetric={setBubblesMetric}
              config={bubblesConfig}
              onChangeConfig={setBubblesConfig}
              onReset={resetBubblesConfig}
            />
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
