// src/viewer/components/viewer/viewer.tsx
import * as React from "react";
import { ViewerEngine } from "../../engine/viewer-engine";
import type { HeatmapStyle } from "../../../store/heatmap-style";
import type { WellPoint } from "../hooks/use-viewer-wells";
import { usePozosStyle } from "../../../store/pozos-style";
import { useMapViewOptions } from "../../../store/map-view-options";
import "./viewer.css";

import type {
  ElipseRow,
  EllipsesPolygonStyle,
} from "../../engine/layers/elipses/ellipses-polygons-layer";

import type { BubblePoint } from "../../engine/layers/bubbles/bubbles-layer";
import type { BubblesStyleConfig as EngineBubblesStyleConfig } from "../../engine/layers/bubbles/bubbles-layer";

import {
  useElipsesStyle,
  type ElipsesNormalizationRanges,
  type ElipsesNormalizationContext,
  type ElipsesNormalizationScope,
} from "../../../store/elipses-style";

import { HeatmapColorbar } from "./heatmap-colorbar";
import "./heatmap-colorbar.css";

import { ElipsesReferences } from "../../../components/mapa/elipses-references";
import "../../../components/mapa/elipses-references.css";

import { useMapaElipsesVisibilityStore } from "../../../store/mapa-elipses-visibility";
import { useMapaElipsesFiltersStore } from "../../../store/mapa-elipses-filters-store";
import type { MapKey } from "../../../store/mapa-display-store";
import { BubbleMetric } from "../../../store/bubbles-style";

type MapaData = {
  grid: (number | null)[][];
  xEdges: number[];
  yEdges: number[];
};

type Props = {
  ellipses: ElipseRow[];
  wells?: WellPoint[];

  bubbles?: BubblePoint[];
  bubblesStyle?: EngineBubblesStyleConfig | null;
  bubblesMetric?: BubbleMetric;

  mapKey?: MapKey | null;

  mapaMissing?: boolean;

  selectedDate: string | null;
  selectedVariable: string | null;

  gridEnabled?: boolean;
  gridSpacingX?: number;
  gridSpacingY?: number;

  mapaData?: MapaData | null;
  heatmapStyle?: HeatmapStyle;
  heatmapDataMin?: number;
  heatmapDataMax?: number;

  colorbarTitle?: string;

  // ✅ overlay refs toggle
  showElipsesReferences?: boolean;

  // Elipses references (desde el parent)
  fillOpacityVar: string | null;
  fillColorVar: string | null;

  axisOpacityVar: string | null;
  axisColorVar: string | null;

  // Contorno vars (legacy firma)
  contourOpacityVar: string | null;
  contourWidthVar: string | null;
  contourColorVar: string | null;

  // normalización (legacy/global)
  normalizationRanges?: ElipsesNormalizationRanges;
  normalizationScope?: ElipsesNormalizationScope;
  normalizationContext?: ElipsesNormalizationContext;

  // fill normalization
  fillNormalizationRanges?: ElipsesNormalizationRanges;
  fillNormalizationScope?: ElipsesNormalizationScope;
  fillNormalizationContext?: ElipsesNormalizationContext;

  // contour normalization
  contourNormalizationRanges?: ElipsesNormalizationRanges;
  contourNormalizationScope?: ElipsesNormalizationScope;
  contourNormalizationContext?: ElipsesNormalizationContext;

  // axis normalization
  axisNormalizationRanges?: ElipsesNormalizationRanges;
  axisNormalizationScope?: ElipsesNormalizationScope;
  axisNormalizationContext?: ElipsesNormalizationContext;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * MISMA lógica de ID que usamos en la tabla:
 * - prioriza id
 * - luego id_elipse
 * - fallback derivado
 */
function elipseVisibilityId(e: ElipseRow, idx: number): string {
  const anyE = e as any;
  return (
    (anyE.id as string | null | undefined) ??
    (anyE.id_elipse as string | null | undefined) ??
    `${anyE.capa ?? ""}|${anyE.inyector ?? ""}|${anyE.productor ?? ""}|${idx}`
  );
}

const EMPTY_HIDDEN: Record<string, true> = {};

// ✅ default bubbles config (engine-level)
const DEFAULT_BUBBLES_CFG: EngineBubblesStyleConfig = {
  enabled: true,
  hideNull: true,

  color: "#22c55e",
  opacity: 0.6,
  borderColor: "#1f2937",
  borderWidth: 2,

  scaleMode: "sqrt",
  domain: { mode: "auto", min: 0, max: 1 },

  minRadius: 2,
  maxRadius: 24,
};

export function Viewer({
  ellipses,
  wells = [],

  bubbles = [],
  bubblesStyle = null,

  mapKey = null,

  mapaMissing = false,
  selectedDate,
  selectedVariable,

  gridEnabled = true,
  gridSpacingX = 2000,
  gridSpacingY = 2000,

  mapaData,
  heatmapStyle,
  heatmapDataMin,
  heatmapDataMax,
  colorbarTitle,

  showElipsesReferences = true,

  normalizationRanges,
  normalizationScope,
  normalizationContext,

  fillNormalizationRanges,
  fillNormalizationScope,
  fillNormalizationContext,

  contourNormalizationRanges,
  contourNormalizationScope,
  contourNormalizationContext,

  axisNormalizationRanges,
  axisNormalizationScope,
  axisNormalizationContext,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const engineRef = React.useRef<ViewerEngine | null>(null);
  const rafId = React.useRef<number | null>(null);

  const { pozosStyleConfig } = usePozosStyle();
  const { showElipses, showBubbles } = useMapViewOptions();

  const {
    elipsesStyle,

    fillOpacityVariable,
    fillColorVariable,

    axisOpacityVariable,
    axisWidthVariable,
    axisColorVariable,

    contourOpacityVariable,
    contourWidthVariable,
    contourColorVariable,

    fillNormalizationScope: fillNormalizationScopeFromStore,
    fillNormalizationRanges: fillNormalizationRangesFromStore,
    fillNormalizationContext: fillNormalizationContextFromStore,

    axisNormalizationScope: axisNormalizationScopeFromStore,
    axisNormalizationRanges: axisNormalizationRangesFromStore,
    axisNormalizationContext: axisNormalizationContextFromStore,

    contourNormalizationScope: contourNormalizationScopeFromStore,
    contourNormalizationRanges: contourNormalizationRangesFromStore,
    contourNormalizationContext: contourNormalizationContextFromStore,
  } = useElipsesStyle();

  // ✅ CRÍTICO: suscripción al estado que cambia (bucket por mapKey)
  const hiddenForKey = useMapaElipsesVisibilityStore((s) =>
    mapKey ? (s.hiddenByKey[mapKey] ?? EMPTY_HIDDEN) : EMPTY_HIDDEN,
  );

  // ✅ Filtros (histórico + reglas) por mapKey
  const filtersForKey = useMapaElipsesFiltersStore((s) =>
    mapKey ? s.byKey[mapKey] : null,
  );
  const showHistorical = filtersForKey?.showHistorical ?? false;

  // ✅ el array que realmente se renderiza (filtrado)
  const visibleEllipses = React.useMemo(() => {
    const src = ellipses ?? [];
    if (!mapKey) return src;
    if (!hiddenForKey || hiddenForKey === EMPTY_HIDDEN) return src;

    return src.filter((e, idx) => {
      const id = elipseVisibilityId(e, idx);
      return !hiddenForKey[id];
    });
  }, [ellipses, mapKey, hiddenForKey]);

  // ✅ bubbles ya vienen como BubblePoint[] desde ViewerFloatingWindow.
  // Acá SOLO validamos y filtramos (no recalculamos por métrica).
  const bubblesFinal = React.useMemo<BubblePoint[]>(() => {
    return (bubbles ?? [])
      .map((p: any) => {
        const id = String(p.id ?? "").trim();
        const x = Number(p.x);
        const y = Number(p.y);

        // value: puede venir como número o string
        const value =
          typeof p.value === "number" ? p.value : Number(String(p.value ?? ""));

        if (!id) return null;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        if (!Number.isFinite(value) || value === 0) return null;

        // ✅ preservar pie/nombre si vienen
        const nombre =
          typeof p.nombre === "string" && p.nombre.trim()
            ? p.nombre.trim()
            : undefined;

        const pieRaw = p.pie ?? undefined;
        const pie =
          pieRaw && typeof pieRaw === "object"
            ? {
                petroleo:
                  typeof pieRaw.petroleo === "number" &&
                  Number.isFinite(pieRaw.petroleo)
                    ? pieRaw.petroleo
                    : undefined,
                agua:
                  typeof pieRaw.agua === "number" &&
                  Number.isFinite(pieRaw.agua)
                    ? pieRaw.agua
                    : undefined,
                gas:
                  typeof pieRaw.gas === "number" && Number.isFinite(pieRaw.gas)
                    ? pieRaw.gas
                    : undefined,
                aguaIny:
                  typeof pieRaw.aguaIny === "number" &&
                  Number.isFinite(pieRaw.aguaIny)
                    ? pieRaw.aguaIny
                    : undefined,
              }
            : undefined;

        const out: BubblePoint = { id, x, y, value };
        if (nombre) (out as any).nombre = nombre;
        if (pie) (out as any).pie = pie;

        return out;
      })
      .filter((b): b is BubblePoint => !!b);
  }, [bubbles]);

  // ✅ Config final: viene del parent (engine config) y fallback a default
  const bubblesCfgFinal = React.useMemo<EngineBubblesStyleConfig>(() => {
    return bubblesStyle ?? DEFAULT_BUBBLES_CFG;
  }, [bubblesStyle]);

  const lastScaleRef = React.useRef<{ min: number; max: number } | null>(null);

  React.useEffect(() => {
    if (isFiniteNumber(heatmapDataMin) && isFiniteNumber(heatmapDataMax)) {
      lastScaleRef.current = { min: heatmapDataMin, max: heatmapDataMax };
    }
  }, [heatmapDataMin, heatmapDataMax]);

  const polyStyle: EllipsesPolygonStyle = React.useMemo(() => {
    const fillColorMode = elipsesStyle.fillColorMode;
    const fillColorRangeMode = elipsesStyle.fillColorValueRangeMode;
    const fillAlphaRangeMode = elipsesStyle.fillValueRangeMode;

    const axisColorMode = elipsesStyle.axisColorMode;
    const axisColorRangeMode = elipsesStyle.axisColorValueRangeMode;
    const axisWidthRangeMode = elipsesStyle.axisWidthValueRangeMode;
    const axisAlphaRangeMode = elipsesStyle.axisOpacityValueRangeMode;

    const strokeColorMode = elipsesStyle.contourColorMode;
    const strokeColorRangeMode = elipsesStyle.contourColorValueRangeMode;
    const strokeWidthRangeMode = elipsesStyle.contourWidthValueRangeMode;
    const strokeAlphaRangeMode = elipsesStyle.contourOpacityValueRangeMode;

    const fillColorVarFinal =
      (elipsesStyle.fillColorAttr?.enabled
        ? elipsesStyle.fillColorAttr.variable
        : null) ??
      fillColorVariable ??
      null;

    const fillOpacityVarFinal =
      (elipsesStyle.fillOpacityAttr?.enabled
        ? elipsesStyle.fillOpacityAttr.variable
        : null) ??
      fillOpacityVariable ??
      null;

    const strokeColorVarFinal =
      (elipsesStyle.contourColorAttr?.enabled
        ? elipsesStyle.contourColorAttr.variable
        : null) ??
      contourColorVariable ??
      null;

    const strokeWidthVarFinal =
      (elipsesStyle.contourWidthAttr?.enabled
        ? elipsesStyle.contourWidthAttr.variable
        : null) ??
      contourWidthVariable ??
      null;

    const strokeOpacityVarFinal =
      (elipsesStyle.contourOpacityAttr?.enabled
        ? elipsesStyle.contourOpacityAttr.variable
        : null) ??
      contourOpacityVariable ??
      null;

    return {
      strokeEnabled: elipsesStyle.contourEnabled,
      strokeColor: elipsesStyle.contourColor,
      strokeWidth: elipsesStyle.contourWidth,
      strokeMinAlpha: elipsesStyle.contourMinAlpha,
      strokeMaxAlpha: elipsesStyle.contourMaxAlpha,

      fillEnabled: elipsesStyle.fillEnabled,
      fillColor: elipsesStyle.fillColor,
      fillMinAlpha: elipsesStyle.fillMinAlpha,
      fillMaxAlpha: elipsesStyle.fillMaxAlpha,

      fillChannels: {
        enabled: elipsesStyle.fillEnabled,
        color: {
          mode: fillColorMode,
          variable: fillColorVarFinal,
          fixedColor: elipsesStyle.fillColor,
          minColor: elipsesStyle.fillColorMin,
          maxColor: elipsesStyle.fillColorMax,
          rangeMode: fillColorRangeMode,
          valueMin: elipsesStyle.fillColorValueMin,
          valueMax: elipsesStyle.fillColorValueMax,
        },
        alpha: {
          variable: fillOpacityVarFinal,
          rangeMode: fillAlphaRangeMode,
          valueMin: elipsesStyle.fillValueMin,
          valueMax: elipsesStyle.fillValueMax,
          minAlpha: elipsesStyle.fillMinAlpha,
          maxAlpha: elipsesStyle.fillMaxAlpha,
        },
      },

      axisEnabled: elipsesStyle.axisEnabled,
      axisColor: elipsesStyle.axisColor,
      axisMinWidth: elipsesStyle.axisMinWidth,
      axisMaxWidth: elipsesStyle.axisMaxWidth,
      axisMinAlpha: elipsesStyle.axisMinAlpha,
      axisMaxAlpha: elipsesStyle.axisMaxAlpha,

      axisChannels: {
        enabled: elipsesStyle.axisEnabled,
        color: {
          mode: axisColorMode,
          variable:
            (elipsesStyle.axisColorAttr?.enabled
              ? elipsesStyle.axisColorAttr.variable
              : null) ??
            axisColorVariable ??
            null,
          fixedColor: elipsesStyle.axisColor,
          minColor: elipsesStyle.axisColorMin,
          maxColor: elipsesStyle.axisColorMax,
          rangeMode: axisColorRangeMode,
          valueMin: elipsesStyle.axisColorValueMin,
          valueMax: elipsesStyle.axisColorValueMax,
        },
        width: {
          variable:
            (elipsesStyle.axisWidthAttr?.enabled
              ? elipsesStyle.axisWidthAttr.variable
              : null) ??
            axisWidthVariable ??
            null,
          rangeMode: axisWidthRangeMode,
          valueMin: elipsesStyle.axisWidthValueMin,
          valueMax: elipsesStyle.axisWidthValueMax,
        },
        alpha: {
          variable:
            (elipsesStyle.axisOpacityAttr?.enabled
              ? elipsesStyle.axisOpacityAttr.variable
              : null) ??
            axisOpacityVariable ??
            null,
          rangeMode: axisAlphaRangeMode,
          valueMin: elipsesStyle.axisOpacityValueMin,
          valueMax: elipsesStyle.axisOpacityValueMax,
        },
      },

      strokeChannels: {
        enabled: elipsesStyle.contourEnabled,
        color: {
          mode: strokeColorMode,
          variable: strokeColorVarFinal,
          fixedColor: elipsesStyle.contourColor,
          minColor: elipsesStyle.contourColorMin,
          maxColor: elipsesStyle.contourColorMax,
          rangeMode: strokeColorRangeMode,
          valueMin: elipsesStyle.contourColorValueMin,
          valueMax: elipsesStyle.contourColorValueMax,
        },
        width: {
          variable: strokeWidthVarFinal,
          rangeMode: strokeWidthRangeMode,
          valueMin: elipsesStyle.contourWidthValueMin,
          valueMax: elipsesStyle.contourWidthValueMax,
          minWidth: elipsesStyle.contourMinWidth,
          maxWidth: elipsesStyle.contourMaxWidth,
        },
        alpha: {
          variable: strokeOpacityVarFinal,
          rangeMode: strokeAlphaRangeMode,
          valueMin: elipsesStyle.contourOpacityValueMin,
          valueMax: elipsesStyle.contourOpacityValueMax,
          minAlpha: elipsesStyle.contourMinAlpha,
          maxAlpha: elipsesStyle.contourMaxAlpha,
        },
      },
    } as EllipsesPolygonStyle;
  }, [
    elipsesStyle,
    fillOpacityVariable,
    fillColorVariable,
    axisOpacityVariable,
    axisWidthVariable,
    axisColorVariable,
    contourOpacityVariable,
    contourWidthVariable,
    contourColorVariable,
  ]);

  const pushGlobalNormalizationToEngine = React.useCallback(() => {
    const engine = engineRef.current as any;
    if (!engine) return;

    const ranges = normalizationRanges ?? {};
    const scope = normalizationScope ?? null;
    const ctx = normalizationContext ?? null;

    if (typeof engine.setEllipsesNormalization === "function") {
      engine.setEllipsesNormalization({ ranges, scope, context: ctx });
    }
  }, [normalizationRanges, normalizationScope, normalizationContext]);

  const pushFillNormalizationToEngine = React.useCallback(() => {
    const engine = engineRef.current as any;
    if (!engine) return;

    const ranges =
      fillNormalizationRanges ?? fillNormalizationRangesFromStore ?? {};
    const scope =
      fillNormalizationScope ?? fillNormalizationScopeFromStore ?? null;
    const ctx =
      fillNormalizationContext ?? fillNormalizationContextFromStore ?? null;

    if (typeof engine.setFillNormalization === "function") {
      engine.setFillNormalization({
        color: { ranges, scope, context: ctx },
        alpha: { ranges, scope, context: ctx },
      });
    }
  }, [
    fillNormalizationRanges,
    fillNormalizationScope,
    fillNormalizationContext,
    fillNormalizationRangesFromStore,
    fillNormalizationScopeFromStore,
    fillNormalizationContextFromStore,
  ]);

  const pushAxisNormalizationToEngine = React.useCallback(() => {
    const engine = engineRef.current as any;
    if (!engine) return;

    const ranges =
      axisNormalizationRanges ?? axisNormalizationRangesFromStore ?? {};
    const scope =
      axisNormalizationScope ?? axisNormalizationScopeFromStore ?? null;
    const ctx =
      axisNormalizationContext ?? axisNormalizationContextFromStore ?? null;

    if (typeof engine.setAxisNormalization === "function") {
      engine.setAxisNormalization({
        color: { ranges, scope, context: ctx },
        width: { ranges, scope, context: ctx },
        alpha: { ranges, scope, context: ctx },
      });
    }
  }, [
    axisNormalizationRanges,
    axisNormalizationScope,
    axisNormalizationContext,
    axisNormalizationRangesFromStore,
    axisNormalizationScopeFromStore,
    axisNormalizationContextFromStore,
  ]);

  const pushContourNormalizationToEngine = React.useCallback(() => {
    const engine = engineRef.current as any;
    if (!engine) return;

    const ranges =
      contourNormalizationRanges ?? contourNormalizationRangesFromStore ?? {};
    const scope =
      contourNormalizationScope ?? contourNormalizationScopeFromStore ?? null;
    const ctx =
      contourNormalizationContext ??
      contourNormalizationContextFromStore ??
      null;

    if (typeof engine.setContourNormalization === "function") {
      engine.setContourNormalization({
        color: { ranges, scope, context: ctx },
        width: { ranges, scope, context: ctx },
        alpha: { ranges, scope, context: ctx },
      });
    }
  }, [
    contourNormalizationRanges,
    contourNormalizationScope,
    contourNormalizationContext,
    contourNormalizationRangesFromStore,
    contourNormalizationScopeFromStore,
    contourNormalizationContextFromStore,
  ]);

  // ─────────────────────────────────────────────
  // Init engine
  // ─────────────────────────────────────────────
  React.useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    const engine = new ViewerEngine({ container, backgroundAlpha: 0 });
    engineRef.current = engine;

    engine.attachOverlay(overlay);

    engine.setGrid({
      enabled: gridEnabled,
      spacingX: gridSpacingX,
      spacingY: gridSpacingY,
      color: "rgba(0,0,0,0.12)",
      width: 1,
    });

    engine.setWells(wells ?? []);
    engine.setPozosStyleConfig(pozosStyleConfig);

    engine.setEllipses(visibleEllipses ?? []);
    engine.setShowElipses(showElipses);

    // ✅ BUBBLES: data + style + visibility
    (engine as any).setBubbles?.(bubblesFinal ?? []);
    (engine as any).setBubblesStyleConfig?.(bubblesCfgFinal);
    (engine as any).setShowBubbles?.(!!showBubbles);

    engine.setElipsesStyle(polyStyle);
    engine.setEllipsesContext({
      selectedDate,
      selectedVariable,
      showHistorical,
    });

    pushGlobalNormalizationToEngine();
    pushFillNormalizationToEngine();
    pushAxisNormalizationToEngine();
    pushContourNormalizationToEngine();

    engine.resize(container.clientWidth || 1, container.clientHeight || 1);

    const ro = new ResizeObserver(() => {
      const el = containerRef.current;
      const eng = engineRef.current;
      if (!el || !eng) return;

      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        eng.resize(el.clientWidth || 1, el.clientHeight || 1);
      });
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // updates
  React.useEffect(() => {
    engineRef.current?.setGrid({
      enabled: gridEnabled,
      spacingX: gridSpacingX,
      spacingY: gridSpacingY,
    });
  }, [gridEnabled, gridSpacingX, gridSpacingY]);

  React.useEffect(() => {
    engineRef.current?.setPozosStyleConfig(pozosStyleConfig);
  }, [pozosStyleConfig]);

  React.useEffect(() => {
    engineRef.current?.setWells(wells ?? []);
  }, [wells]);

  React.useEffect(() => {
    engineRef.current?.setEllipses(visibleEllipses ?? []);
  }, [visibleEllipses]);

  React.useEffect(() => {
    engineRef.current?.setShowElipses(showElipses);
  }, [showElipses]);

  // ✅ update bubbles data
  React.useEffect(() => {
    const engine = engineRef.current as any;
    if (!engine) return;
    if (typeof engine.setBubbles === "function") {
      engine.setBubbles(bubblesFinal ?? []);
    }
  }, [bubblesFinal]);

  // ✅ update bubbles style (DEBUG TEMPORAL)
  React.useEffect(() => {
    const engine = engineRef.current as any;
    if (!engine) return;

    // eslint-disable-next-line no-console
    console.log("[Viewer] bubblesCfgFinal", bubblesCfgFinal);
    // eslint-disable-next-line no-console
    console.log("[Viewer] bubblesFinal[0]", bubblesFinal?.[0]);

    if (typeof engine.setBubblesStyleConfig === "function") {
      engine.setBubblesStyleConfig(bubblesCfgFinal);
    }
  }, [bubblesCfgFinal, bubblesFinal]);

  // ✅ update bubbles visibility
  React.useEffect(() => {
    const engine = engineRef.current as any;
    if (!engine) return;
    if (typeof engine.setShowBubbles === "function") {
      engine.setShowBubbles(!!showBubbles);
    }
  }, [showBubbles]);

  React.useEffect(() => {
    engineRef.current?.setElipsesStyle(polyStyle);
  }, [polyStyle]);

  React.useEffect(() => {
    engineRef.current?.setEllipsesContext({
      selectedDate,
      selectedVariable,
      showHistorical,
    });
  }, [selectedDate, selectedVariable, showHistorical]);

  React.useEffect(() => {
    pushGlobalNormalizationToEngine();
  }, [pushGlobalNormalizationToEngine]);

  React.useEffect(() => {
    pushFillNormalizationToEngine();
  }, [pushFillNormalizationToEngine]);

  React.useEffect(() => {
    pushAxisNormalizationToEngine();
  }, [pushAxisNormalizationToEngine]);

  React.useEffect(() => {
    pushContourNormalizationToEngine();
  }, [pushContourNormalizationToEngine]);

  React.useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (
      mapaData &&
      heatmapStyle &&
      heatmapDataMin != null &&
      heatmapDataMax != null
    ) {
      engine.setHeatmap({
        grid: mapaData.grid,
        xEdges: mapaData.xEdges,
        yEdges: mapaData.yEdges,
        style: heatmapStyle,
        dataMin: heatmapDataMin,
        dataMax: heatmapDataMax,
      });
    } else {
      engine.clearHeatmap();
    }
  }, [mapaData, heatmapStyle, heatmapDataMin, heatmapDataMax]);

  // Interacciones
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pixiCanvas = container.querySelector(
      'canvas:not([data-overlay="1"])',
    ) as HTMLCanvasElement | null;

    if (!pixiCanvas) return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      engineRef.current?.setCameraInteracting(true);
      (e.target as Element).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      engineRef.current?.panBy(dx, dy);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      engineRef.current?.setCameraInteracting(false);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = pixiCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const delta = Math.sign(e.deltaY);
      const ZOOM_STEP = 0.97;
      const factor = delta > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;

      engineRef.current?.setCameraInteracting(true);
      engineRef.current?.zoomAt(factor, x, y);

      window.clearTimeout((onWheel as any)._t);
      (onWheel as any)._t = window.setTimeout(() => {
        engineRef.current?.setCameraInteracting(false);
      }, 120);
    };

    pixiCanvas.addEventListener("pointerdown", onPointerDown);
    pixiCanvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    pixiCanvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      pixiCanvas.removeEventListener("pointerdown", onPointerDown);
      pixiCanvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      pixiCanvas.removeEventListener("wheel", onWheel as any);
    };
  }, []);

  const last = lastScaleRef.current;
  const showScale =
    !!mapaData && !!heatmapStyle?.showScale && !!heatmapStyle && !!last;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10000,
          pointerEvents: "none",
        }}
      >
        <div
          className={[
            "viewerElipsesRefs",
            showElipsesReferences ? "is-visible" : "is-hidden",
          ].join(" ")}
        >
          <ElipsesReferences
            visible={
              !!showElipsesReferences &&
              showElipses &&
              visibleEllipses.length > 0
            }
          />
        </div>

        {showScale && heatmapStyle && last && (
          <HeatmapColorbar
            heatmapStyle={heatmapStyle}
            min={last.min}
            max={last.max}
            title={colorbarTitle}
          />
        )}

        {mapaMissing && (
          <div
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              padding: "6px 10px",
              fontSize: 12,
              color: "#f05a5aff",
              background: "rgba(255,255,255,0.85)",
              border: "1px solid #f05a5aff",
              borderRadius: 4,
              pointerEvents: "none",
              zIndex: 10001,
            }}
          >
            Mapa no disponible
          </div>
        )}
      </div>

      <canvas
        ref={overlayRef}
        data-overlay="1"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
    </div>
  );
}
