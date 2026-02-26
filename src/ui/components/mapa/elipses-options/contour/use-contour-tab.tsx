// src/components/mapa/elipses-options/contour/use-contour-tab.tsx
import { useEffect, useMemo } from "react";
import type {
  ElipsesNormalizationRanges,
  ElipsesNormalizationScope,
  ElipsesStyle,
  ColorAttribute,
  WidthAttribute,
  OpacityAttribute,
} from "../../../../store/elipses-style";
import {
  useElipsesNormalization,
  getAutoRangeForVariable,
} from "../../../../hooks/use-elipses-normalization";

export type ContourNormByScope = Record<
  ElipsesNormalizationScope,
  {
    loading: boolean;
    ranges: ElipsesNormalizationRanges;
    error: string | null;
  }
>;

function sameNumber(a: number | null, b: number | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

function coerceScope(v: unknown): ElipsesNormalizationScope {
  if (
    v === "layer_date" ||
    v === "layer_all" ||
    v === "field_date" ||
    v === "field_all"
  )
    return v;
  return "layer_date";
}

function pickRangesForScope(
  scope: ElipsesNormalizationScope,
  byScope: ContourNormByScope,
): ElipsesNormalizationRanges {
  return byScope[scope]?.ranges ?? {};
}

type ContourAttr = ColorAttribute | WidthAttribute | OpacityAttribute;

export function useContourTab({
  tabActive,
  elipseVariables,

  style,
  onChangeStyle,

  yacimientoId,
  capaNombre,
  fecha,
}: {
  tabActive: boolean;
  elipseVariables: string[];

  style: ElipsesStyle;
  onChangeStyle: (s: ElipsesStyle) => void;

  yacimientoId: string | null;
  capaNombre: string | null;
  fecha: string | null; // YYYY-MM-DD
}) {
  const contourEnabled = !!style.contourEnabled;
  const firstVar = elipseVariables[0] ?? null;

  // -----------------------------
  // Normalización DB (4 scopes)
  // -----------------------------
  const baseArgs = useMemo(
    () => ({
      yacimientoId: tabActive ? yacimientoId : null,
      capaNombre: tabActive ? capaNombre : null,
      fecha: tabActive ? fecha : null,
    }),
    [tabActive, yacimientoId, capaNombre, fecha],
  );

  const norm_layer_date = useElipsesNormalization({
    ...baseArgs,
    scope: "layer_date",
  });
  const norm_layer_all = useElipsesNormalization({
    ...baseArgs,
    scope: "layer_all",
  });
  const norm_field_date = useElipsesNormalization({
    ...baseArgs,
    scope: "field_date",
  });
  const norm_field_all = useElipsesNormalization({
    ...baseArgs,
    scope: "field_all",
  });

  const contourNormByScope: ContourNormByScope = useMemo(
    () => ({
      layer_date: norm_layer_date,
      layer_all: norm_layer_all,
      field_date: norm_field_date,
      field_all: norm_field_all,
    }),
    [norm_layer_date, norm_layer_all, norm_field_date, norm_field_all],
  );

  // -----------------------------
  // Seed variables + normalizar shape de ranges (por atributo)
  // -----------------------------
  useEffect(() => {
    if (!tabActive || !contourEnabled || !firstVar) return;

    let changed = false;
    const next = structuredClone(style);

    const ensureAttr = (
      attr: ContourAttr,
      manualMinDefault = 0,
      manualMaxDefault = 1,
    ) => {
      if (!attr.enabled) return;

      if (attr.enabled && !attr.variable) {
        attr.variable = firstVar;
        changed = true;
      }

      if (!attr.range?.min) {
        (attr as any).range = (attr as any).range ?? {};
        (attr as any).range.min = {
          mode: "auto",
          scope: "layer_date",
          manual: manualMinDefault,
          lastAuto: null,
        };
        changed = true;
      }

      if (!attr.range?.max) {
        (attr as any).range = (attr as any).range ?? {};
        (attr as any).range.max = {
          mode: "auto",
          scope: "layer_date",
          manual: manualMaxDefault,
          lastAuto: null,
        };
        changed = true;
      }

      // compat: si venía mode guardando scope (viejo)
      const mMin = (attr as any).range.min?.mode;
      if (
        mMin === "layer_date" ||
        mMin === "layer_all" ||
        mMin === "field_date" ||
        mMin === "field_all"
      ) {
        (attr as any).range.min.mode = "auto";
        (attr as any).range.min.scope = mMin;
        changed = true;
      }

      const mMax = (attr as any).range.max?.mode;
      if (
        mMax === "layer_date" ||
        mMax === "layer_all" ||
        mMax === "field_date" ||
        mMax === "field_all"
      ) {
        (attr as any).range.max.mode = "auto";
        (attr as any).range.max.scope = mMax;
        changed = true;
      }

      (attr as any).range.min.mode =
        (attr as any).range.min.mode === "manual" ? "manual" : "auto";
      (attr as any).range.max.mode =
        (attr as any).range.max.mode === "manual" ? "manual" : "auto";

      (attr as any).range.min.scope = coerceScope(
        (attr as any).range.min.scope,
      );
      (attr as any).range.max.scope = coerceScope(
        (attr as any).range.max.scope,
      );

      if (!Number.isFinite((attr as any).range.min.manual)) {
        (attr as any).range.min.manual = manualMinDefault;
        changed = true;
      }
      if (!Number.isFinite((attr as any).range.max.manual)) {
        (attr as any).range.max.manual = manualMaxDefault;
        changed = true;
      }
    };

    ensureAttr(next.contourColorAttr as unknown as ContourAttr, 0, 1);
    ensureAttr(next.contourWidthAttr as unknown as ContourAttr, 0, 1);
    ensureAttr(next.contourOpacityAttr as unknown as ContourAttr, 0, 1);

    if (changed) onChangeStyle(next);
  }, [tabActive, contourEnabled, firstVar, style, onChangeStyle]);

  // -----------------------------
  // Resolver lastAuto por extremo usando scope del extremo
  // -----------------------------
  useEffect(() => {
    if (!tabActive || !contourEnabled) return;

    let changed = false;
    const next = structuredClone(style);

    const applyLastAuto = (attr: ContourAttr) => {
      if (!attr.enabled) return;
      const v = (attr as any).variable ?? null;
      if (!v) return;

      // MIN auto
      if ((attr as any).range?.min?.mode !== "manual") {
        const scopeMin: ElipsesNormalizationScope = coerceScope(
          (attr as any).range?.min?.scope,
        );
        const rangesMin = pickRangesForScope(scopeMin, contourNormByScope);
        const autoMin = getAutoRangeForVariable(rangesMin, v).min;

        const val =
          typeof autoMin === "number" && Number.isFinite(autoMin)
            ? autoMin
            : null;

        if (!sameNumber((attr as any).range.min.lastAuto ?? null, val)) {
          (attr as any).range.min.lastAuto = val;
          changed = true;
        }
      }

      // MAX auto
      if ((attr as any).range?.max?.mode !== "manual") {
        const scopeMax: ElipsesNormalizationScope = coerceScope(
          (attr as any).range?.max?.scope,
        );
        const rangesMax = pickRangesForScope(scopeMax, contourNormByScope);
        const autoMax = getAutoRangeForVariable(rangesMax, v).max;

        const val =
          typeof autoMax === "number" && Number.isFinite(autoMax)
            ? autoMax
            : null;

        if (!sameNumber((attr as any).range.max.lastAuto ?? null, val)) {
          (attr as any).range.max.lastAuto = val;
          changed = true;
        }
      }
    };

    applyLastAuto(next.contourColorAttr as unknown as ContourAttr);
    applyLastAuto(next.contourWidthAttr as unknown as ContourAttr);
    applyLastAuto(next.contourOpacityAttr as unknown as ContourAttr);

    if (changed) onChangeStyle(next);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tabActive,
    contourEnabled,

    contourNormByScope.layer_date.ranges,
    contourNormByScope.layer_all.ranges,
    contourNormByScope.field_date.ranges,
    contourNormByScope.field_all.ranges,

    style.contourColorAttr,
    style.contourWidthAttr,
    style.contourOpacityAttr,
  ]);

  return {
    contourEnabled,
    contourNormByScope,
  };
}
