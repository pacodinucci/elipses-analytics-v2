// src/store/elipses-style.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Alcance de normalización (backend /elipses/normalization)
 */
export type ElipsesNormalizationScope =
  | "layer_date"
  | "field_date"
  | "field_all"
  | "layer_all";

/**
 * Modo de rango (LEGACY y también usado por el nuevo modelo por input)
 */
export type RangeMode = "auto" | "manual";

/**
 * ===========================
 * ✅ MODELO NUEVO (por atributo)
 * ===========================
 */
export type RangeInput = {
  mode: RangeMode;
  scope: ElipsesNormalizationScope; // cuando mode === "auto"
  manual: number; // cuando mode === "manual"
  lastAuto: number | null; // cache UI
};

export type VariableRange = {
  min: RangeInput;
  max: RangeInput;
};

export type FixedOrVariable<TFixed, TVariable> =
  | { enabled: false; fixed: TFixed }
  | ({ enabled: true } & TVariable);

export type ColorAttribute = FixedOrVariable<
  { color: string }, // fixed "#RRGGBB"
  {
    variable: string | null;
    minColor: string;
    maxColor: string;
    range: VariableRange; // dominio (min/max dato)
  }
>;

export type WidthAttribute = FixedOrVariable<
  { width: number }, // fixed px
  {
    variable: string | null;
    minWidth: number; // salida px
    maxWidth: number; // salida px
    range: VariableRange; // dominio (min/max dato)
  }
>;

export type OpacityAttribute = FixedOrVariable<
  { opacity: number }, // fixed 0..1
  {
    variable: string | null;
    minOpacity: number; // salida 0..1
    maxOpacity: number; // salida 0..1
    range: VariableRange; // dominio (min/max dato)
  }
>;

/**
 * ===========================
 * ✅ MODELO LEGACY (NO ROMPER)
 * ===========================
 */
export type LegacyElipsesStyle = {
  fillEnabled: boolean;
  contourEnabled: boolean;
  axisEnabled: boolean;

  // fill legacy
  fillColor: string;
  fillColorMode: "fixed" | "variable";
  fillColorMin: string;
  fillColorMax: string;
  fillMinAlpha: number;
  fillMaxAlpha: number;

  fillValueRangeMode: RangeMode;
  fillValueMin: number;
  fillValueMax: number;

  fillColorValueRangeMode: RangeMode;
  fillColorValueMin: number;
  fillColorValueMax: number;

  // contour legacy
  contourColor: string;
  contourMinAlpha: number;
  contourMaxAlpha: number;
  contourWidth: number;

  contourValueRangeMode: RangeMode;
  contourValueMin: number;
  contourValueMax: number;

  contourColorMode: "fixed" | "variable";
  contourColorMin: string;
  contourColorMax: string;

  contourMinWidth: number;
  contourMaxWidth: number;

  contourOpacityValueRangeMode: RangeMode;
  contourOpacityValueMin: number;
  contourOpacityValueMax: number;

  contourWidthValueRangeMode: RangeMode;
  contourWidthValueMin: number;
  contourWidthValueMax: number;

  contourColorValueRangeMode: RangeMode;
  contourColorValueMin: number;
  contourColorValueMax: number;

  // axis legacy
  axisColor: string;
  axisColorMode: "fixed" | "variable";
  axisColorMin: string;
  axisColorMax: string;
  axisMinAlpha: number;
  axisMaxAlpha: number;
  axisMinWidth: number;
  axisMaxWidth: number;

  axisOpacityValueRangeMode: RangeMode;
  axisOpacityValueMin: number;
  axisOpacityValueMax: number;

  axisWidthValueRangeMode: RangeMode;
  axisWidthValueMin: number;
  axisWidthValueMax: number;

  axisColorValueRangeMode: RangeMode;
  axisColorValueMin: number;
  axisColorValueMax: number;
};

/**
 * ✅ Estilo final = legacy + nuevo.
 */
export type ElipsesStyle = LegacyElipsesStyle & {
  fillColorAttr: ColorAttribute;
  fillOpacityAttr: OpacityAttribute;

  contourColorAttr: ColorAttribute;
  contourWidthAttr: WidthAttribute;
  contourOpacityAttr: OpacityAttribute;

  axisColorAttr: ColorAttribute;
  axisWidthAttr: WidthAttribute;
  axisOpacityAttr: OpacityAttribute;
};

// ------------------------
// Defaults helpers
// ------------------------
const makeRangeInput = (
  mode: RangeMode,
  manual: number,
  scope: ElipsesNormalizationScope = "layer_date",
  lastAuto: number | null = null,
): RangeInput => ({ mode, manual, scope, lastAuto });

const makeVariableRange = (
  mode: RangeMode,
  manualMin: number,
  manualMax: number,
  minScope: ElipsesNormalizationScope = "layer_date",
  maxScope: ElipsesNormalizationScope = "layer_date",
): VariableRange => ({
  min: makeRangeInput(mode, manualMin, minScope, null),
  max: makeRangeInput(mode, manualMax, maxScope, null),
});

// ------------------------
// Default legacy
// ------------------------
const DEFAULT_LEGACY: LegacyElipsesStyle = {
  fillEnabled: true,
  contourEnabled: true,
  axisEnabled: true,

  fillColor: "#ff00ff",
  fillColorMode: "fixed",
  fillColorMin: "#00ff00",
  fillColorMax: "#ff00ff",
  fillMinAlpha: 0.1,
  fillMaxAlpha: 0.8,

  fillValueRangeMode: "auto",
  fillValueMin: 0,
  fillValueMax: 1,

  fillColorValueRangeMode: "auto",
  fillColorValueMin: 0,
  fillColorValueMax: 1,

  contourColor: "#ff00ff",
  contourMinAlpha: 0.2,
  contourMaxAlpha: 1,
  contourWidth: 1,

  contourValueRangeMode: "auto",
  contourValueMin: 0,
  contourValueMax: 1,

  contourColorMode: "fixed",
  contourColorMin: "#00ff00",
  contourColorMax: "#ff00ff",
  contourMinWidth: 0.5,
  contourMaxWidth: 2.5,

  contourOpacityValueRangeMode: "auto",
  contourOpacityValueMin: 0,
  contourOpacityValueMax: 1,

  contourWidthValueRangeMode: "auto",
  contourWidthValueMin: 0,
  contourWidthValueMax: 1,

  contourColorValueRangeMode: "auto",
  contourColorValueMin: 0,
  contourColorValueMax: 1,

  axisColor: "#000000",
  axisColorMode: "fixed",
  axisColorMin: "#00ff00",
  axisColorMax: "#ff00ff",
  axisMinAlpha: 0.3,
  axisMaxAlpha: 1,
  axisMinWidth: 0.5,
  axisMaxWidth: 4,

  axisOpacityValueRangeMode: "auto",
  axisOpacityValueMin: 0,
  axisOpacityValueMax: 1,

  axisWidthValueRangeMode: "auto",
  axisWidthValueMin: 0,
  axisWidthValueMax: 1,

  axisColorValueRangeMode: "auto",
  axisColorValueMin: 0,
  axisColorValueMax: 1,
};

// ------------------------
// Default nuevo (mirror inicial)
// ------------------------
const DEFAULT_NEW = {
  fillColorAttr: {
    enabled: false,
    fixed: { color: DEFAULT_LEGACY.fillColor },
  } as ColorAttribute,
  fillOpacityAttr: {
    enabled: true,
    variable: null,
    minOpacity: DEFAULT_LEGACY.fillMinAlpha,
    maxOpacity: DEFAULT_LEGACY.fillMaxAlpha,
    range: makeVariableRange(
      DEFAULT_LEGACY.fillValueRangeMode,
      DEFAULT_LEGACY.fillValueMin,
      DEFAULT_LEGACY.fillValueMax,
    ),
  } as OpacityAttribute,

  contourColorAttr: {
    enabled: false,
    fixed: { color: DEFAULT_LEGACY.contourColor },
  } as ColorAttribute,
  contourWidthAttr: {
    enabled: true,
    variable: null,
    minWidth: DEFAULT_LEGACY.contourMinWidth,
    maxWidth: DEFAULT_LEGACY.contourMaxWidth,
    range: makeVariableRange(
      DEFAULT_LEGACY.contourWidthValueRangeMode,
      DEFAULT_LEGACY.contourWidthValueMin,
      DEFAULT_LEGACY.contourWidthValueMax,
    ),
  } as WidthAttribute,
  contourOpacityAttr: {
    enabled: true,
    variable: null,
    minOpacity: DEFAULT_LEGACY.contourMinAlpha,
    maxOpacity: DEFAULT_LEGACY.contourMaxAlpha,
    range: makeVariableRange(
      DEFAULT_LEGACY.contourOpacityValueRangeMode,
      DEFAULT_LEGACY.contourOpacityValueMin,
      DEFAULT_LEGACY.contourOpacityValueMax,
    ),
  } as OpacityAttribute,

  axisColorAttr: {
    enabled: false,
    fixed: { color: DEFAULT_LEGACY.axisColor },
  } as ColorAttribute,
  axisWidthAttr: {
    enabled: true,
    variable: null,
    minWidth: DEFAULT_LEGACY.axisMinWidth,
    maxWidth: DEFAULT_LEGACY.axisMaxWidth,
    range: makeVariableRange(
      DEFAULT_LEGACY.axisWidthValueRangeMode,
      DEFAULT_LEGACY.axisWidthValueMin,
      DEFAULT_LEGACY.axisWidthValueMax,
    ),
  } as WidthAttribute,
  axisOpacityAttr: {
    enabled: true,
    variable: null,
    minOpacity: DEFAULT_LEGACY.axisMinAlpha,
    maxOpacity: DEFAULT_LEGACY.axisMaxAlpha,
    range: makeVariableRange(
      DEFAULT_LEGACY.axisOpacityValueRangeMode,
      DEFAULT_LEGACY.axisOpacityValueMin,
      DEFAULT_LEGACY.axisOpacityValueMax,
    ),
  } as OpacityAttribute,
};

export const DEFAULT_ELIPSES_STYLE: ElipsesStyle = {
  ...DEFAULT_LEGACY,
  ...DEFAULT_NEW,
};

// ------------------------
// Normalization (ranges provenientes de DB)
// ------------------------
export type ElipsesNormalizationRanges = Record<
  string,
  { min: number | null; max: number | null }
>;

/**
 * ✅ v2: yacimientoId removido => usamos proyectoId.
 * Mantengo capaNombre/fecha porque tu payload actual de normalización sigue siendo por nombre.
 * (Si migrás a capaId después, esto se ajusta fácil.)
 */
export type ElipsesNormalizationContext = {
  scope: ElipsesNormalizationScope;
  proyectoId: string | null;
  capaNombre: string | null;
  fecha: string | null;
  updatedAt: number | null;
};

function makeDefaultNormalizationContext(
  scope: ElipsesNormalizationScope = "layer_date",
): ElipsesNormalizationContext {
  return {
    scope,
    proyectoId: null,
    capaNombre: null,
    fecha: null,
    updatedAt: null,
  };
}

function makeDefaultElipsesStyle(): ElipsesStyle {
  return structuredClone(DEFAULT_ELIPSES_STYLE);
}

function normalizeRangeInputMaybeLegacy(input: any): RangeInput {
  const fallback: RangeInput = makeRangeInput("auto", 0, "layer_date", null);

  if (!input || typeof input !== "object") return fallback;

  const rawMode = input.mode;

  if (
    rawMode === "layer_date" ||
    rawMode === "layer_all" ||
    rawMode === "field_date" ||
    rawMode === "field_all"
  ) {
    return {
      mode: "auto",
      scope: rawMode,
      manual:
        typeof input.manual === "number" && Number.isFinite(input.manual)
          ? input.manual
          : 0,
      lastAuto:
        typeof input.lastAuto === "number" && Number.isFinite(input.lastAuto)
          ? input.lastAuto
          : null,
    };
  }

  const mode: RangeMode = rawMode === "manual" ? "manual" : "auto";

  const scope: ElipsesNormalizationScope =
    input.scope === "layer_date" ||
    input.scope === "layer_all" ||
    input.scope === "field_date" ||
    input.scope === "field_all"
      ? input.scope
      : "layer_date";

  return {
    mode,
    scope,
    manual:
      typeof input.manual === "number" && Number.isFinite(input.manual)
        ? input.manual
        : 0,
    lastAuto:
      typeof input.lastAuto === "number" && Number.isFinite(input.lastAuto)
        ? input.lastAuto
        : null,
  };
}

function normalizeVariableRangeMaybeLegacy(range: any): VariableRange {
  const fallback = makeVariableRange("auto", 0, 1);
  if (!range || typeof range !== "object") return fallback;

  return {
    min: normalizeRangeInputMaybeLegacy(range.min),
    max: normalizeRangeInputMaybeLegacy(range.max),
  };
}

// ------------------------
// SYNC legacy helpers
// ------------------------
function syncLegacyAxisFromNew(style: ElipsesStyle): ElipsesStyle {
  const next = style;

  if (next.axisColorAttr.enabled) {
    next.axisColorMode = "variable";
    next.axisColorMin = next.axisColorAttr.minColor;
    next.axisColorMax = next.axisColorAttr.maxColor;

    const minE = normalizeRangeInputMaybeLegacy(next.axisColorAttr.range?.min);
    const maxE = normalizeRangeInputMaybeLegacy(next.axisColorAttr.range?.max);

    next.axisColorValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";
    next.axisColorValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.axisColorValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.axisColorAttr.range = { min: minE, max: maxE };
  } else {
    next.axisColorMode = "fixed";
    next.axisColor = next.axisColorAttr.fixed.color;
  }

  next.axisMinWidth = next.axisWidthAttr.enabled
    ? next.axisWidthAttr.minWidth
    : next.axisWidthAttr.fixed.width;
  next.axisMaxWidth = next.axisWidthAttr.enabled
    ? next.axisWidthAttr.maxWidth
    : next.axisWidthAttr.fixed.width;

  if (next.axisWidthAttr.enabled) {
    const minE = normalizeRangeInputMaybeLegacy(next.axisWidthAttr.range?.min);
    const maxE = normalizeRangeInputMaybeLegacy(next.axisWidthAttr.range?.max);

    next.axisWidthValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";
    next.axisWidthValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.axisWidthValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.axisWidthAttr.range = { min: minE, max: maxE };
  }

  next.axisMinAlpha = next.axisOpacityAttr.enabled
    ? next.axisOpacityAttr.minOpacity
    : next.axisOpacityAttr.fixed.opacity;
  next.axisMaxAlpha = next.axisOpacityAttr.enabled
    ? next.axisOpacityAttr.maxOpacity
    : next.axisOpacityAttr.fixed.opacity;

  if (next.axisOpacityAttr.enabled) {
    const minE = normalizeRangeInputMaybeLegacy(
      next.axisOpacityAttr.range?.min,
    );
    const maxE = normalizeRangeInputMaybeLegacy(
      next.axisOpacityAttr.range?.max,
    );

    next.axisOpacityValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";
    next.axisOpacityValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.axisOpacityValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.axisOpacityAttr.range = { min: minE, max: maxE };
  }

  return next;
}

function syncLegacyContourFromNew(style: ElipsesStyle): ElipsesStyle {
  const next = style;

  if (next.contourColorAttr.enabled) {
    next.contourColorMode = "variable";
    next.contourColorMin = next.contourColorAttr.minColor;
    next.contourColorMax = next.contourColorAttr.maxColor;

    const minE = normalizeRangeInputMaybeLegacy(
      next.contourColorAttr.range?.min,
    );
    const maxE = normalizeRangeInputMaybeLegacy(
      next.contourColorAttr.range?.max,
    );

    next.contourColorValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";

    next.contourColorValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.contourColorValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.contourColor = next.contourColorAttr.minColor ?? next.contourColor;

    next.contourColorAttr.range = { min: minE, max: maxE };
  } else {
    next.contourColorMode = "fixed";
    next.contourColor = next.contourColorAttr.fixed.color;
  }

  next.contourMinWidth = next.contourWidthAttr.enabled
    ? next.contourWidthAttr.minWidth
    : next.contourWidthAttr.fixed.width;
  next.contourMaxWidth = next.contourWidthAttr.enabled
    ? next.contourWidthAttr.maxWidth
    : next.contourWidthAttr.fixed.width;

  if (next.contourWidthAttr.enabled) {
    const minE = normalizeRangeInputMaybeLegacy(
      next.contourWidthAttr.range?.min,
    );
    const maxE = normalizeRangeInputMaybeLegacy(
      next.contourWidthAttr.range?.max,
    );

    next.contourWidthValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";

    next.contourWidthValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.contourWidthValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.contourWidthAttr.range = { min: minE, max: maxE };
  }

  next.contourMinAlpha = next.contourOpacityAttr.enabled
    ? next.contourOpacityAttr.minOpacity
    : next.contourOpacityAttr.fixed.opacity;
  next.contourMaxAlpha = next.contourOpacityAttr.enabled
    ? next.contourOpacityAttr.maxOpacity
    : next.contourOpacityAttr.fixed.opacity;

  if (next.contourOpacityAttr.enabled) {
    const minE = normalizeRangeInputMaybeLegacy(
      next.contourOpacityAttr.range?.min,
    );
    const maxE = normalizeRangeInputMaybeLegacy(
      next.contourOpacityAttr.range?.max,
    );

    next.contourOpacityValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";

    next.contourOpacityValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.contourOpacityValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.contourOpacityAttr.range = { min: minE, max: maxE };
  }

  return next;
}

function syncLegacyFillFromNew(style: ElipsesStyle): ElipsesStyle {
  const next = style;

  // Color
  if (next.fillColorAttr.enabled) {
    next.fillColorMode = "variable";
    next.fillColorMin = next.fillColorAttr.minColor;
    next.fillColorMax = next.fillColorAttr.maxColor;

    const minE = normalizeRangeInputMaybeLegacy(next.fillColorAttr.range?.min);
    const maxE = normalizeRangeInputMaybeLegacy(next.fillColorAttr.range?.max);

    next.fillColorValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";

    next.fillColorValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.fillColorValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.fillColor = next.fillColorAttr.minColor ?? next.fillColor;

    next.fillColorAttr.range = { min: minE, max: maxE };
  } else {
    next.fillColorMode = "fixed";
    next.fillColor = next.fillColorAttr.fixed.color;
  }

  // Alpha (salida visual)
  next.fillMinAlpha = next.fillOpacityAttr.enabled
    ? next.fillOpacityAttr.minOpacity
    : next.fillOpacityAttr.fixed.opacity;
  next.fillMaxAlpha = next.fillOpacityAttr.enabled
    ? next.fillOpacityAttr.maxOpacity
    : next.fillOpacityAttr.fixed.opacity;

  if (next.fillOpacityAttr.enabled) {
    const minE = normalizeRangeInputMaybeLegacy(
      next.fillOpacityAttr.range?.min,
    );
    const maxE = normalizeRangeInputMaybeLegacy(
      next.fillOpacityAttr.range?.max,
    );

    next.fillValueRangeMode =
      minE.mode === "manual" || maxE.mode === "manual" ? "manual" : "auto";

    next.fillValueMin =
      minE.mode === "manual" ? minE.manual : (minE.lastAuto ?? minE.manual);
    next.fillValueMax =
      maxE.mode === "manual" ? maxE.manual : (maxE.lastAuto ?? maxE.manual);

    next.fillOpacityAttr.range = { min: minE, max: maxE };
  }

  return next;
}

// ------------------------
// Zustand state
// ------------------------
type ElipsesStyleState = {
  elipsesStyle: ElipsesStyle;

  setElipsesStyle: (style: Partial<ElipsesStyle>) => void;
  resetElipsesStyle: () => void;

  fillOpacityVariable: string | null;
  fillColorVariable: string | null;

  contourLinkChannels: boolean;
  contourOpacityVariable: string | null;
  contourWidthVariable: string | null;
  contourColorVariable: string | null;

  axisLinkChannels: boolean;
  axisOpacityVariable: string | null;
  axisWidthVariable: string | null;
  axisColorVariable: string | null;

  setFillOpacityVariable: (v: string | null) => void;
  setFillColorVariable: (v: string | null) => void;

  setContourLinkChannels: (v: boolean) => void;
  setContourOpacityVariable: (v: string | null) => void;
  setContourWidthVariable: (v: string | null) => void;
  setContourColorVariable: (v: string | null) => void;

  setAxisLinkChannels: (v: boolean) => void;
  setAxisOpacityVariable: (v: string | null) => void;
  setAxisWidthVariable: (v: string | null) => void;
  setAxisColorVariable: (v: string | null) => void;

  resetMapping: () => void;
  sanitizeVariables: (available: string[]) => void;

  normalizationScope: ElipsesNormalizationScope;
  setNormalizationScope: (v: ElipsesNormalizationScope) => void;

  normalizationRanges: ElipsesNormalizationRanges;
  normalizationContext: ElipsesNormalizationContext;

  setNormalizationRanges: (
    ranges: ElipsesNormalizationRanges,
    ctx: Omit<ElipsesNormalizationContext, "updatedAt">,
  ) => void;

  clearNormalizationRanges: () => void;

  fillNormalizationScope: ElipsesNormalizationScope;
  setFillNormalizationScope: (v: ElipsesNormalizationScope) => void;

  fillNormalizationRanges: ElipsesNormalizationRanges;
  fillNormalizationContext: ElipsesNormalizationContext;

  setFillNormalizationRanges: (
    ranges: ElipsesNormalizationRanges,
    ctx: Omit<ElipsesNormalizationContext, "updatedAt">,
  ) => void;

  clearFillNormalizationRanges: () => void;

  axisNormalizationScope: ElipsesNormalizationScope;
  setAxisNormalizationScope: (v: ElipsesNormalizationScope) => void;

  axisNormalizationRanges: ElipsesNormalizationRanges;
  axisNormalizationContext: ElipsesNormalizationContext;

  setAxisNormalizationRanges: (
    ranges: ElipsesNormalizationRanges,
    ctx: Omit<ElipsesNormalizationContext, "updatedAt">,
  ) => void;

  clearAxisNormalizationRanges: () => void;

  contourNormalizationScope: ElipsesNormalizationScope;
  setContourNormalizationScope: (v: ElipsesNormalizationScope) => void;

  contourNormalizationRanges: ElipsesNormalizationRanges;
  contourNormalizationContext: ElipsesNormalizationContext;

  setContourNormalizationRanges: (
    ranges: ElipsesNormalizationRanges,
    ctx: Omit<ElipsesNormalizationContext, "updatedAt">,
  ) => void;

  clearContourNormalizationRanges: () => void;
};

export const useElipsesStyle = create<ElipsesStyleState>()(
  persist(
    (set, get) => ({
      elipsesStyle: makeDefaultElipsesStyle(),

      setElipsesStyle: (partial) =>
        set((s) => {
          const merged: ElipsesStyle = {
            ...makeDefaultElipsesStyle(),
            ...s.elipsesStyle,
            ...partial,
          };

          // normalizar ranges nuevos
          if (merged.axisColorAttr?.enabled)
            merged.axisColorAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.axisColorAttr.range,
            );
          if (merged.axisWidthAttr?.enabled)
            merged.axisWidthAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.axisWidthAttr.range,
            );
          if (merged.axisOpacityAttr?.enabled)
            merged.axisOpacityAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.axisOpacityAttr.range,
            );

          if (merged.contourColorAttr?.enabled)
            merged.contourColorAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.contourColorAttr.range,
            );
          if (merged.contourWidthAttr?.enabled)
            merged.contourWidthAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.contourWidthAttr.range,
            );
          if (merged.contourOpacityAttr?.enabled)
            merged.contourOpacityAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.contourOpacityAttr.range,
            );

          if (merged.fillColorAttr?.enabled)
            merged.fillColorAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.fillColorAttr.range,
            );
          if (merged.fillOpacityAttr?.enabled)
            merged.fillOpacityAttr.range = normalizeVariableRangeMaybeLegacy(
              merged.fillOpacityAttr.range,
            );

          const syncedAxis = syncLegacyAxisFromNew(merged);
          const syncedContour = syncLegacyContourFromNew(syncedAxis);
          const synced = syncLegacyFillFromNew(syncedContour);

          return { elipsesStyle: synced };
        }),

      resetElipsesStyle: () => set({ elipsesStyle: makeDefaultElipsesStyle() }),

      // mapping vars
      fillOpacityVariable: null,
      fillColorVariable: null,

      contourLinkChannels: true,
      contourOpacityVariable: null,
      contourWidthVariable: null,
      contourColorVariable: null,

      axisLinkChannels: true,
      axisOpacityVariable: null,
      axisWidthVariable: null,
      axisColorVariable: null,

      setFillOpacityVariable: (v) => set({ fillOpacityVariable: v }),
      setFillColorVariable: (v) => set({ fillColorVariable: v }),

      setContourLinkChannels: (v) =>
        set(() => {
          if (v) {
            const op = get().contourOpacityVariable;
            return { contourLinkChannels: true, contourWidthVariable: op };
          }
          return { contourLinkChannels: false };
        }),

      setContourOpacityVariable: (v) =>
        set(() => {
          if (get().contourLinkChannels)
            return { contourOpacityVariable: v, contourWidthVariable: v };
          return { contourOpacityVariable: v };
        }),

      setContourWidthVariable: (v) => set({ contourWidthVariable: v }),
      setContourColorVariable: (v) => set({ contourColorVariable: v }),

      setAxisLinkChannels: (v) =>
        set(() => {
          if (v) {
            const op = get().axisOpacityVariable;
            return { axisLinkChannels: true, axisWidthVariable: op };
          }
          return { axisLinkChannels: false };
        }),

      setAxisOpacityVariable: (v) =>
        set(() => {
          if (get().axisLinkChannels)
            return { axisOpacityVariable: v, axisWidthVariable: v };
          return { axisOpacityVariable: v };
        }),

      setAxisWidthVariable: (v) => set({ axisWidthVariable: v }),
      setAxisColorVariable: (v) => set({ axisColorVariable: v }),

      resetMapping: () =>
        set({
          fillOpacityVariable: null,
          fillColorVariable: null,

          contourLinkChannels: true,
          contourOpacityVariable: null,
          contourWidthVariable: null,
          contourColorVariable: null,

          axisLinkChannels: true,
          axisOpacityVariable: null,
          axisWidthVariable: null,
          axisColorVariable: null,
        }),

      sanitizeVariables: (available) =>
        set((s) => {
          const first = available[0] ?? null;
          const has = (v: string | null) => (v ? available.includes(v) : false);

          const nextFillOpacity = has(s.fillOpacityVariable)
            ? s.fillOpacityVariable
            : first;
          const nextFillColor = has(s.fillColorVariable)
            ? s.fillColorVariable
            : first;

          const nextContourOpacity = has(s.contourOpacityVariable)
            ? s.contourOpacityVariable
            : first;

          let nextContourWidth = s.contourWidthVariable;
          if (s.contourLinkChannels) nextContourWidth = nextContourOpacity;
          else
            nextContourWidth = has(nextContourWidth) ? nextContourWidth : first;

          const nextContourColor = has(s.contourColorVariable)
            ? s.contourColorVariable
            : first;

          const nextAxisOpacity = has(s.axisOpacityVariable)
            ? s.axisOpacityVariable
            : first;

          let nextAxisWidth = s.axisWidthVariable;
          if (s.axisLinkChannels) nextAxisWidth = nextAxisOpacity;
          else nextAxisWidth = has(nextAxisWidth) ? nextAxisWidth : first;

          const nextAxisColor = has(s.axisColorVariable)
            ? s.axisColorVariable
            : first;

          return {
            fillOpacityVariable: nextFillOpacity,
            fillColorVariable: nextFillColor,

            contourOpacityVariable: nextContourOpacity,
            contourWidthVariable: nextContourWidth,
            contourColorVariable: nextContourColor,

            axisOpacityVariable: nextAxisOpacity,
            axisWidthVariable: nextAxisWidth,
            axisColorVariable: nextAxisColor,
          };
        }),

      // normalization global
      normalizationScope: "layer_date",
      setNormalizationScope: (v) => set({ normalizationScope: v }),

      normalizationRanges: {},
      normalizationContext: makeDefaultNormalizationContext("layer_date"),

      setNormalizationRanges: (ranges, ctx) =>
        set(() => ({
          normalizationRanges: ranges ?? {},
          normalizationContext: {
            scope: ctx.scope,
            proyectoId: ctx.proyectoId ?? null,
            capaNombre: ctx.capaNombre ?? null,
            fecha: ctx.fecha ?? null,
            updatedAt: Date.now(),
          },
        })),

      clearNormalizationRanges: () =>
        set(() => ({
          normalizationRanges: {},
          normalizationContext: {
            ...get().normalizationContext,
            updatedAt: Date.now(),
          },
        })),

      // fill normalization (compat)
      fillNormalizationScope: "layer_date",
      setFillNormalizationScope: (v) => set({ fillNormalizationScope: v }),

      fillNormalizationRanges: {},
      fillNormalizationContext: makeDefaultNormalizationContext("layer_date"),

      setFillNormalizationRanges: (ranges, ctx) =>
        set(() => ({
          fillNormalizationRanges: ranges ?? {},
          fillNormalizationContext: {
            scope: ctx.scope,
            proyectoId: ctx.proyectoId ?? null,
            capaNombre: ctx.capaNombre ?? null,
            fecha: ctx.fecha ?? null,
            updatedAt: Date.now(),
          },
        })),

      clearFillNormalizationRanges: () =>
        set(() => ({
          fillNormalizationRanges: {},
          fillNormalizationContext: {
            ...get().fillNormalizationContext,
            updatedAt: Date.now(),
          },
        })),

      // axis normalization (compat)
      axisNormalizationScope: "layer_date",
      setAxisNormalizationScope: (v) => set({ axisNormalizationScope: v }),

      axisNormalizationRanges: {},
      axisNormalizationContext: makeDefaultNormalizationContext("layer_date"),

      setAxisNormalizationRanges: (ranges, ctx) =>
        set(() => ({
          axisNormalizationRanges: ranges ?? {},
          axisNormalizationContext: {
            scope: ctx.scope,
            proyectoId: ctx.proyectoId ?? null,
            capaNombre: ctx.capaNombre ?? null,
            fecha: ctx.fecha ?? null,
            updatedAt: Date.now(),
          },
        })),

      clearAxisNormalizationRanges: () =>
        set(() => ({
          axisNormalizationRanges: {},
          axisNormalizationContext: {
            ...get().axisNormalizationContext,
            updatedAt: Date.now(),
          },
        })),

      // contour normalization (compat)
      contourNormalizationScope: "layer_date",
      setContourNormalizationScope: (v) =>
        set({ contourNormalizationScope: v }),

      contourNormalizationRanges: {},
      contourNormalizationContext:
        makeDefaultNormalizationContext("layer_date"),

      setContourNormalizationRanges: (ranges, ctx) =>
        set(() => ({
          contourNormalizationRanges: ranges ?? {},
          contourNormalizationContext: {
            scope: ctx.scope,
            proyectoId: ctx.proyectoId ?? null,
            capaNombre: ctx.capaNombre ?? null,
            fecha: ctx.fecha ?? null,
            updatedAt: Date.now(),
          },
        })),

      clearContourNormalizationRanges: () =>
        set(() => ({
          contourNormalizationRanges: {},
          contourNormalizationContext: {
            ...get().contourNormalizationContext,
            updatedAt: Date.now(),
          },
        })),
    }),
    {
      name: "elipsis:elipses-style",
      version: 12, // ✅ bump por rename yacimientoId -> proyectoId
      migrate: (persisted: any) => {
        if (!persisted || typeof persisted !== "object") return persisted;

        const legacy = persisted.elipsesStyle ?? {};
        const merged: ElipsesStyle = {
          ...makeDefaultElipsesStyle(),
          ...legacy,
        };

        if (!merged.axisColorAttr)
          merged.axisColorAttr = structuredClone(DEFAULT_NEW.axisColorAttr);
        if (!merged.axisWidthAttr)
          merged.axisWidthAttr = structuredClone(DEFAULT_NEW.axisWidthAttr);
        if (!merged.axisOpacityAttr)
          merged.axisOpacityAttr = structuredClone(DEFAULT_NEW.axisOpacityAttr);

        if (!merged.contourColorAttr)
          merged.contourColorAttr = structuredClone(
            DEFAULT_NEW.contourColorAttr,
          );
        if (!merged.contourWidthAttr)
          merged.contourWidthAttr = structuredClone(
            DEFAULT_NEW.contourWidthAttr,
          );
        if (!merged.contourOpacityAttr)
          merged.contourOpacityAttr = structuredClone(
            DEFAULT_NEW.contourOpacityAttr,
          );

        if (!merged.fillColorAttr)
          merged.fillColorAttr = structuredClone(DEFAULT_NEW.fillColorAttr);
        if (!merged.fillOpacityAttr)
          merged.fillOpacityAttr = structuredClone(DEFAULT_NEW.fillOpacityAttr);

        if (merged.axisColorAttr?.enabled)
          merged.axisColorAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.axisColorAttr.range,
          );
        if (merged.axisWidthAttr?.enabled)
          merged.axisWidthAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.axisWidthAttr.range,
          );
        if (merged.axisOpacityAttr?.enabled)
          merged.axisOpacityAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.axisOpacityAttr.range,
          );

        if (merged.contourColorAttr?.enabled)
          merged.contourColorAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.contourColorAttr.range,
          );
        if (merged.contourWidthAttr?.enabled)
          merged.contourWidthAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.contourWidthAttr.range,
          );
        if (merged.contourOpacityAttr?.enabled)
          merged.contourOpacityAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.contourOpacityAttr.range,
          );

        if (merged.fillColorAttr?.enabled)
          merged.fillColorAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.fillColorAttr.range,
          );
        if (merged.fillOpacityAttr?.enabled)
          merged.fillOpacityAttr.range = normalizeVariableRangeMaybeLegacy(
            merged.fillOpacityAttr.range,
          );

        const syncedAxis = syncLegacyAxisFromNew(merged);
        const syncedContour = syncLegacyContourFromNew(syncedAxis);
        const synced = syncLegacyFillFromNew(syncedContour);

        // ✅ migrate contexts: yacimientoId -> proyectoId
        const migrateCtx = (ctx: any): ElipsesNormalizationContext => {
          const scope: ElipsesNormalizationScope =
            ctx?.scope === "layer_date" ||
            ctx?.scope === "layer_all" ||
            ctx?.scope === "field_date" ||
            ctx?.scope === "field_all"
              ? ctx.scope
              : "layer_date";

          const proyectoId =
            (typeof ctx?.proyectoId === "string" && ctx.proyectoId) ||
            (typeof ctx?.yacimientoId === "string" && ctx.yacimientoId) ||
            null;

          return {
            scope,
            proyectoId,
            capaNombre:
              typeof ctx?.capaNombre === "string" ? ctx.capaNombre : null,
            fecha: typeof ctx?.fecha === "string" ? ctx.fecha : null,
            updatedAt:
              typeof ctx?.updatedAt === "number" ? ctx.updatedAt : null,
          };
        };

        return {
          ...persisted,
          elipsesStyle: synced,

          normalizationContext: migrateCtx(persisted.normalizationContext),
          fillNormalizationContext: migrateCtx(
            persisted.fillNormalizationContext,
          ),
          axisNormalizationContext: migrateCtx(
            persisted.axisNormalizationContext,
          ),
          contourNormalizationContext: migrateCtx(
            persisted.contourNormalizationContext,
          ),
        };
      },
    },
  ),
);
