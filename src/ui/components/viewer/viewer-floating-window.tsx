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
import type { ProduccionPozo } from "../../types/produccion";

// ✅ ENGINE bubbles types
import type { BubblesStyleConfig as EngineBubblesStyleConfig } from "../../viewer/engine/layers/bubbles/bubbles-layer";

// ✅ STORE bubbles types (NO mezclar con el engine)
import { useBubblesStyle } from "../../store/bubbles-style";

import { BubblesOptionsModal } from "../mapa/bubbles-options-modal";

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
// Helpers (escenarios v2)
// =========================
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

function isLikelyProductionTypeName(tipoNombre: string) {
  const t = normalizeName(tipoNombre);
  return t.includes("prod") || t.includes("hist");
}

function pickBestScenarioForViewer(
  escenarios: Escenario[],
  tipos: TipoEscenario[],
): { escenario: Escenario | null; reason: string } {
  if (!escenarios.length) return { escenario: null, reason: "NO_SCENARIOS" };

  const tipoById = new Map(tipos.map((t) => [t.id, t] as const));

  // 1) Preferir tipo “producción/hist”
  for (const e of escenarios) {
    const tipo = tipoById.get(e.tipoEscenarioId);
    if (tipo && isLikelyProductionTypeName(tipo.nombre)) {
      return { escenario: e, reason: `TYPE_MATCH:${tipo.nombre}` };
    }
  }

  // 2) Preferir nombre del escenario
  for (const e of escenarios) {
    const n = normalizeName(e.nombre);
    if (n.includes("prod") || n.includes("hist")) {
      return { escenario: e, reason: `NAME_MATCH:${e.nombre}` };
    }
  }

  // 3) fallback: más reciente (tu repo los ordena DESC)
  return { escenario: escenarios[0], reason: "FALLBACK_MOST_RECENT" };
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
  // tu regla: válido si es finito y distinto de 0
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

  // histórico: si la fecha actual es válida, gana
  const direct = map[fecha];
  if (isValidValue(direct)) return direct;

  // buscar hacia atrás (YYYY-MM-DD compara lexicográficamente)
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

  // ✅ bubbles store (tipado correcto)
  const bubblesConfig = useBubblesStyle((s) => s.config);
  const setBubblesConfig = useBubblesStyle((s) => s.setConfig);
  const resetBubblesConfig = useBubblesStyle((s) => s.reset);
  const bubbleMetric = useBubblesStyle((s) => s.metric);
  const setBubblesMetric = useBubblesStyle((s) => s.setMetric);

  // ✅ IMPORTANTÍSIMO: no uses destructuring {config: ...} porque te mezcla tipos fácil
  const bubblesStoreCfg = useBubblesStyle(
    (s) => s.config,
  ) as StoreBubblesStyleConfig;

  const bubblesEngineCfg: EngineBubblesStyleConfig = React.useMemo(() => {
    const cfg = bubblesStoreCfg as any;

    return {
      ...cfg,
      hideNull: true,

      // ✅ defaults robustos (aunque venga vacío)
      renderMode: cfg.renderMode ?? "circle",
      pieKeys: cfg.pieKeys?.length
        ? cfg.pieKeys
        : ["petroleo", "agua", "gas", "aguaIny"],
      pieColors: cfg.pieColors ?? {
        petroleo: "#2b2b2b",
        agua: "#2f80ed",
        gas: "#f2c94c",
        aguaIny: "#56ccf2",
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

  // ✅ Selección global v2: solo proyecto
  const proyectoId = useSelectionStore((s) => s.selectedProyectoId);

  // ✅ COMPAT: mientras pozos/elipses/normalización sigan legacy,
  // usamos proyectoId como "id operativo" (antes yacimientoId).
  const yacimientoIdCompat = proyectoId ?? null;

  // ✅ MapaDisplayStore bridge (DatosMapaFloatingWindow)
  const makeKey = useMapaDisplayStore((s) => s.makeKey);
  const setActiveKey = useMapaDisplayStore((s) => s.setActiveKey);
  const upsertDisplayed = useMapaDisplayStore((s) => s.upsert);

  const mapKey = React.useMemo(() => {
    return makeKey({
      proyectoId: proyectoId ?? null,
      capa: capa ?? null,
      variable: variable ?? null,
    });
  }, [makeKey, proyectoId, capa, variable]);

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
  // 1) Rango de fechas del proyecto
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

    // ⚠️ Legacy en tu store/hook de proyectos (cuando migres proyectos, lo cambiamos):
    const fi = (proyecto as any).fecha_inicio as string | null | undefined;
    const ff = (proyecto as any).fecha_fin as string | null | undefined;

    if (!fi || !ff) {
      setProjectMonths([]);
      setProjectError(
        "El proyecto debe tener fecha_inicio y fecha_fin para generar el rango de meses.",
      );
      return;
    }

    const start = parseIsoDate(fi);
    const end = parseIsoDate(ff);

    if (!start || !end) {
      setProjectMonths([]);
      setProjectError(
        "Formato inválido en fecha_inicio/fecha_fin del proyecto.",
      );
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
  // 4.5) Producción v2 (Escenario + ValorEscenario)
  // =========================
  const [produccionRows, setProduccionRows] = React.useState<ProduccionPozo[]>(
    [],
  );
  const [produccionLoading, setProduccionLoading] = React.useState(false);
  const [produccionError, setProduccionError] = React.useState<string | null>(
    null,
  );

  const canQueryProduccion = !!proyectoId && !!capa && !!selectedDate;

  const loadProduccion = React.useCallback(async () => {
    if (!canQueryProduccion) {
      setProduccionRows([]);
      setProduccionError(null);
      setProduccionLoading(false);
      return;
    }

    const missing: string[] = [];
    if (!window.electron?.coreCapaListByProject)
      missing.push("coreCapaListByProject");
    if (!window.electron?.corePozoListByProject)
      missing.push("corePozoListByProject");
    if (!window.electron?.scenarioListByProject)
      missing.push("scenarioListByProject");
    if (!window.electron?.scenarioTypeList) missing.push("scenarioTypeList");
    if (!window.electron?.scenarioValueListByEscenario)
      missing.push("scenarioValueListByEscenario");

    if (missing.length) {
      setProduccionError(
        `IPC no disponible: window.electron.${missing.join(", ")}()`,
      );
      setProduccionRows([]);
      setProduccionLoading(false);
      return;
    }

    setProduccionLoading(true);
    setProduccionError(null);

    try {
      const [capas, pozos, escenarios, tipos] = await Promise.all([
        window.electron.coreCapaListByProject({ proyectoId: proyectoId! }),
        window.electron.corePozoListByProject({ proyectoId: proyectoId! }),
        window.electron.scenarioListByProject({ proyectoId: proyectoId! }),
        window.electron.scenarioTypeList(),
      ]);

      // resolver capaId por nombre
      const needle = normalizeName(capa!);
      const capaFound =
        (capas ?? []).find(
          (c) => normalizeName(String((c as any).nombre ?? "")) === needle,
        ) ?? null;

      if (!capaFound?.id) {
        setProduccionRows([]);
        setProduccionError(`No se encontró la capa "${capa}" en el proyecto.`);
        return;
      }

      const capaId = String(capaFound.id);

      // elegir escenario preferido (producción/hist)
      const pick = pickBestScenarioForViewer(escenarios ?? [], tipos ?? []);
      if (!pick.escenario) {
        setProduccionRows([]);
        setProduccionError(
          "No hay escenarios en este proyecto. Creá un escenario de producción/histórico.",
        );
        return;
      }

      const escenario = pick.escenario;

      // cargar valores del escenario y filtrar por capaId+fecha
      const valores = await window.electron.scenarioValueListByEscenario({
        escenarioId: escenario.id,
      });

      const valoresFiltrados = (valores ?? []).filter((v) => {
        return (
          String((v as any).capaId) === capaId &&
          String((v as any).fecha) === String(selectedDate!)
        );
      });

      // mapear pozos por id
      const pozoById = new Map(
        (pozos ?? []).map((p) => [
          String((p as any).id),
          {
            id: String((p as any).id),
            nombre: String((p as any).nombre ?? "—"),
            x:
              typeof (p as any).x === "number" && Number.isFinite((p as any).x)
                ? (p as any).x
                : null,
            y:
              typeof (p as any).y === "number" && Number.isFinite((p as any).y)
                ? (p as any).y
                : null,
          },
        ]),
      );

      // construir rows para bubbles + snapshot
      const out: ProduccionPozo[] = (valoresFiltrados ?? []).map((v) => {
        const pozoId = String((v as any).pozoId);
        const pozo = pozoById.get(pozoId) ?? {
          id: pozoId,
          nombre: "—",
          x: null,
          y: null,
        };

        // ⚠️ ProduccionPozo es legacy; completamos fields típicos.
        // Si tu tipo tiene más campos, lo ajustamos cuando lo pegues.
        return {
          id: pozo.id,
          nombre: pozo.nombre,
          x: pozo.x,
          y: pozo.y,
          petroleo: (v as any).petroleo ?? null,
          agua: (v as any).agua ?? null,
          gas: (v as any).gas ?? null,
          agua_iny: (v as any).inyeccionAgua ?? null,
        } as unknown as ProduccionPozo;
      });

      out.sort((a: any, b: any) =>
        String(a?.nombre ?? "").localeCompare(String(b?.nombre ?? ""), "es", {
          sensitivity: "base",
        }),
      );

      setProduccionRows(out);
    } catch (e: any) {
      setProduccionRows([]);
      setProduccionError(e?.message ?? String(e));
    } finally {
      setProduccionLoading(false);
    }
  }, [canQueryProduccion, proyectoId, capa, selectedDate]);

  React.useEffect(() => {
    loadProduccion();
  }, [loadProduccion]);

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
    capa,
    variable,
    heatmapStyle,
  });

  const mapaDataForViewer = React.useMemo(() => {
    if (!mapaData) return null;

    const xEdges = (mapaData as any).xEdges;
    const yEdges = (mapaData as any).yEdges;
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
  // 3) Pozos por fecha/capa (legacy hook)
  // =========================
  const { wells, error: wellsError } = useViewerWells({
    yacimientoId: yacimientoIdCompat ?? null,
    capa,
    selectedDate,
  });

  // =========================
  // 4) Elipses (legacy)
  // =========================
  const {
    elipses,
    loading: elipsesLoading,
    error: elipsesError,
  } = useViewerElipses({
    yacimientoId: yacimientoIdCompat ?? null,
    capa,
  });

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

  // Para MapOptionsModal
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
  // 5) Normalización (legacy, usa yacimientoId en hook)
  // =========================
  const backendFecha = React.useMemo(
    () => toBackendDate(selectedDate),
    [selectedDate],
  );

  const normGlobal = useElipsesNormalization({
    yacimientoId: yacimientoIdCompat ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: normalizationScope,
  });

  React.useEffect(() => {
    clearNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yacimientoIdCompat, capa, backendFecha, normalizationScope]);

  React.useEffect(() => {
    if (normGlobal.loading) return;
    if (normGlobal.error) return;
    if (!yacimientoIdCompat) return;

    setNormalizationRanges(normGlobal.ranges ?? {}, {
      scope: normalizationScope,
      yacimientoId: yacimientoIdCompat ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    });
  }, [
    normGlobal.loading,
    normGlobal.error,
    normGlobal.ranges,
    setNormalizationRanges,
    normalizationScope,
    yacimientoIdCompat,
    capa,
    backendFecha,
  ]);

  const normFill = useElipsesNormalization({
    yacimientoId: yacimientoIdCompat ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: fillNormalizationScope,
  });

  React.useEffect(() => {
    clearFillNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yacimientoIdCompat, capa, backendFecha, fillNormalizationScope]);

  React.useEffect(() => {
    if (normFill.loading) return;
    if (normFill.error) return;
    if (!yacimientoIdCompat) return;

    setFillNormalizationRanges(normFill.ranges ?? {}, {
      scope: fillNormalizationScope,
      yacimientoId: yacimientoIdCompat ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    });
  }, [
    normFill.loading,
    normFill.error,
    normFill.ranges,
    setFillNormalizationRanges,
    fillNormalizationScope,
    yacimientoIdCompat,
    capa,
    backendFecha,
  ]);

  const normContour = useElipsesNormalization({
    yacimientoId: yacimientoIdCompat ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: contourNormalizationScope,
  });

  React.useEffect(() => {
    clearContourNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yacimientoIdCompat, capa, backendFecha, contourNormalizationScope]);

  React.useEffect(() => {
    if (normContour.loading) return;
    if (normContour.error) return;
    if (!yacimientoIdCompat) return;

    setContourNormalizationRanges(normContour.ranges ?? {}, {
      scope: contourNormalizationScope,
      yacimientoId: yacimientoIdCompat ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    });
  }, [
    normContour.loading,
    normContour.error,
    normContour.ranges,
    setContourNormalizationRanges,
    contourNormalizationScope,
    yacimientoIdCompat,
    capa,
    backendFecha,
  ]);

  const normAxis = useElipsesNormalization({
    yacimientoId: yacimientoIdCompat ?? null,
    capaNombre: capa ?? null,
    fecha: backendFecha,
    scope: axisNormalizationScope,
  });

  React.useEffect(() => {
    clearAxisNormalizationRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yacimientoIdCompat, capa, backendFecha, axisNormalizationScope]);

  React.useEffect(() => {
    if (normAxis.loading) return;
    if (normAxis.error) return;
    if (!yacimientoIdCompat) return;

    setAxisNormalizationRanges(normAxis.ranges ?? {}, {
      scope: axisNormalizationScope,
      yacimientoId: yacimientoIdCompat ?? null,
      capaNombre: capa ?? null,
      fecha: backendFecha,
    });
  }, [
    normAxis.loading,
    normAxis.error,
    normAxis.ranges,
    setAxisNormalizationRanges,
    axisNormalizationScope,
    yacimientoIdCompat,
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
      showMapa: showMapa && !!mapaData,
      showPozos,
      showElipses,
      pozos: pozosSnapshot,
      elipses: elipsesSnapshot,
      elipseVariables,
      produccion: produccionRows,
    });
  }, [
    upsertDisplayed,
    mapKey,
    proyectoId,
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
  // ✅ bubbles definitivas vía hook (usa ProduccionPozo[])
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
                Cargando producción (escenarios)…
              </p>
            )}
            {produccionError && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Error cargando producción (escenarios): {produccionError}
              </p>
            )}

            {/* Estado de normalización (informativo; no bloquea el render) */}
            {!normGlobal.loading && normGlobal.error && (
              <p style={{ margin: "8px 12px", color: "#a60" }}>
                Normalización (legacy/compat, scope={normalizationScope}):{" "}
                {normGlobal.error}
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
                {/* Left: Fecha + botones */}
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

                {/* Right: Timeline ocupa el resto */}
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
              // context (legacy/compat)
              yacimientoId={yacimientoIdCompat}
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
