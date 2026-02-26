// src/store/heatmap-style.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ColorStop = {
  id: string;
  value: number;
  color: string;
};

export type HeatmapStyle = {
  mode: "preset" | "custom";
  colorscale: "Viridis";
  showScale: boolean;

  colorbarThickness: number;
  customStops: ColorStop[];

  gridEnabled: boolean;
  gridSpacingX: number;
  gridSpacingY: number;

  tickFormat: string;
  tickCount: number;

  // cómo se toma el rango numérico
  valueRangeMode: "auto" | "manual";

  // cómo se colorea
  fillMode: "colors" | "opacity";
  opacityColor: string;
  opacityMin: number;
  opacityMax: number;
};

export function createHeatmapStyleForRange(
  min: number,
  max: number,
): HeatmapStyle {
  const a = Number.isFinite(min) ? min : 0;
  const b = Number.isFinite(max) ? max : 1;

  // si vienen invertidos, los normalizamos
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);

  return {
    mode: "custom",
    colorscale: "Viridis",
    showScale: true,

    colorbarThickness: 20,
    customStops: [
      { id: "min", value: lo, color: "#440154" },
      { id: "max", value: hi, color: "#FDE724" },
    ],

    gridEnabled: true,
    gridSpacingX: 2000,
    gridSpacingY: 2000,

    tickFormat: ".2f",
    tickCount: 6,

    valueRangeMode: "auto",

    fillMode: "colors",
    opacityColor: "#440154",
    opacityMin: lo,
    opacityMax: hi,
  };
}

function sanitizeStops(
  stops: ColorStop[],
  fallbackMin: number,
  fallbackMax: number,
): ColorStop[] {
  const cleaned = (Array.isArray(stops) ? stops : [])
    .map((s) => ({
      id: String(s?.id ?? cryptoSafeId()),
      value: Number(s?.value),
      color: String(s?.color ?? "#000000"),
    }))
    .filter((s) => Number.isFinite(s.value));

  if (cleaned.length === 0) {
    return [
      { id: "min", value: fallbackMin, color: "#440154" },
      { id: "max", value: fallbackMax, color: "#FDE724" },
    ];
  }

  cleaned.sort((a, b) => a.value - b.value);

  // asegurar ids únicos
  const seen = new Set<string>();
  for (const s of cleaned) {
    if (seen.has(s.id)) s.id = `${s.id}-${cryptoSafeId()}`;
    seen.add(s.id);
  }

  return cleaned;
}

function sanitizeStyle(style: HeatmapStyle): HeatmapStyle {
  const baseMin = Number.isFinite(style.opacityMin) ? style.opacityMin : 0;
  const baseMax = Number.isFinite(style.opacityMax) ? style.opacityMax : 1;
  const lo = Math.min(baseMin, baseMax);
  const hi = Math.max(baseMin, baseMax);

  const tickCount =
    typeof style.tickCount === "number" && Number.isFinite(style.tickCount)
      ? Math.max(2, Math.min(20, Math.round(style.tickCount)))
      : 6;

  const colorbarThickness =
    typeof style.colorbarThickness === "number" &&
    Number.isFinite(style.colorbarThickness)
      ? Math.max(8, Math.min(60, Math.round(style.colorbarThickness)))
      : 20;

  const gridSpacingX =
    typeof style.gridSpacingX === "number" &&
    Number.isFinite(style.gridSpacingX)
      ? Math.max(1, style.gridSpacingX)
      : 2000;

  const gridSpacingY =
    typeof style.gridSpacingY === "number" &&
    Number.isFinite(style.gridSpacingY)
      ? Math.max(1, style.gridSpacingY)
      : 2000;

  return {
    ...style,
    colorscale: "Viridis", // por ahora fijo
    showScale: !!style.showScale,
    gridEnabled: !!style.gridEnabled,

    tickFormat: String(style.tickFormat ?? ".2f"),
    tickCount,

    colorbarThickness,

    gridSpacingX,
    gridSpacingY,

    opacityColor: String(style.opacityColor ?? "#440154"),
    opacityMin: lo,
    opacityMax: hi,

    customStops: sanitizeStops(style.customStops, lo, hi),
  };
}

function cryptoSafeId(): string {
  // evitar depender de crypto en entornos raros
  return Math.random().toString(36).slice(2, 9);
}

type HeatmapStyleState = {
  heatmapStyle: HeatmapStyle;

  /**
   * Compat con v1.
   * En v2 vamos a preferir initializedKey.
   */
  initialized: boolean;

  /**
   * ✅ Nuevo: identifica para qué dataset se inicializó.
   * Ej: `${proyectoId}:${capa}:${variable}`
   */
  initializedKey: string | null;

  setHeatmapStyle: (
    updater: HeatmapStyle | ((prev: HeatmapStyle) => HeatmapStyle),
  ) => void;

  /**
   * Compat v1: init global (si no está inicializado, inicializa).
   */
  initHeatmapStyle: (min: number, max: number) => void;

  /**
   * ✅ Nuevo: init por key (si cambia key, reinicializa).
   */
  initHeatmapStyleForKey: (min: number, max: number, key: string) => void;

  /**
   * Reset “duro” (vuelve a 0..1 y marca initialized=false).
   */
  resetHeatmapStyle: () => void;
};

const DEFAULT_STATE: Pick<
  HeatmapStyleState,
  "heatmapStyle" | "initialized" | "initializedKey"
> = {
  heatmapStyle: createHeatmapStyleForRange(0, 1),
  initialized: false,
  initializedKey: null,
};

export const useHeatmapStyle = create<HeatmapStyleState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setHeatmapStyle: (updater) =>
        set((state) => {
          const next =
            typeof updater === "function"
              ? (updater as (prev: HeatmapStyle) => HeatmapStyle)(
                  state.heatmapStyle,
                )
              : updater;

          return { heatmapStyle: sanitizeStyle(next) };
        }),

      initHeatmapStyle: (min, max) =>
        set((state) =>
          state.initialized
            ? state
            : {
                heatmapStyle: sanitizeStyle(
                  createHeatmapStyleForRange(min, max),
                ),
                initialized: true,
                initializedKey: state.initializedKey ?? "__legacy__",
              },
        ),

      initHeatmapStyleForKey: (min, max, key) =>
        set((state) => {
          const k = String(key ?? "");
          if (state.initializedKey === k && state.initialized) return state;

          return {
            heatmapStyle: sanitizeStyle(createHeatmapStyleForRange(min, max)),
            initialized: true,
            initializedKey: k,
          };
        }),

      resetHeatmapStyle: () =>
        set({
          heatmapStyle: sanitizeStyle(createHeatmapStyleForRange(0, 1)),
          initialized: false,
          initializedKey: null,
        }),
    }),
    {
      name: "elipsis:heatmap-style",
      version: 1,
      storage: createJSONStorage(() => localStorage),

      // persistimos solo lo esencial
      partialize: (s) => ({
        heatmapStyle: s.heatmapStyle,
        initialized: s.initialized,
        initializedKey: s.initializedKey,
      }),

      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<HeatmapStyleState>;
        const merged = {
          ...current,
          ...p,
          heatmapStyle: sanitizeStyle(
            (p as any).heatmapStyle ?? current.heatmapStyle,
          ),
          initialized: !!(p as any).initialized,
          initializedKey:
            typeof (p as any).initializedKey === "string"
              ? (p as any).initializedKey
              : null,
        };
        return merged;
      },
    },
  ),
);
