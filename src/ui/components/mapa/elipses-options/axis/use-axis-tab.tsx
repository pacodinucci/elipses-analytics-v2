// src/components/mapa/elipses-options/axis/use-axis-tab.tsx
import { useEffect, useMemo } from "react";
import type {
  ElipsesNormalizationScope,
  ElipsesStyle,
  ElipsesNormalizationRanges,
} from "../../../../store/elipses-style";
import {
  useElipsesNormalization,
  getAutoRangeForVariable,
} from "../../../../hooks/use-elipses-normalization";

// Compat
export type AxisUiMode = "linked_single" | "linked_scale";
export type AxisVarMode = "single" | "multi";

export type AxisNormByScope = Record<
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

function coerceScope(v: any): ElipsesNormalizationScope {
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
  byScope: AxisNormByScope,
): ElipsesNormalizationRanges {
  return byScope[scope]?.ranges ?? {};
}

export function useAxisTab({
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
  fecha: string | null;
}) {
  const axisEnabled = !!style.axisEnabled;
  const firstVar = elipseVariables[0] ?? null;

  // -----------------------------
  // Normalización DB
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

  const axisNormByScope: AxisNormByScope = useMemo(
    () => ({
      layer_date: norm_layer_date,
      layer_all: norm_layer_all,
      field_date: norm_field_date,
      field_all: norm_field_all,
    }),
    [norm_layer_date, norm_layer_all, norm_field_date, norm_field_all],
  );

  // -----------------------------
  // Seed variables + normalizar shape de ranges
  // -----------------------------
  useEffect(() => {
    if (!tabActive || !axisEnabled || !firstVar) return;

    let changed = false;
    const next = structuredClone(style);

    const ensureAttr = (attr: any) => {
      if (!attr?.enabled) return;

      // seed variable
      if (!attr.variable) {
        attr.variable = firstVar;
        changed = true;
      }

      // asegurar structure min/max
      if (!attr.range?.min) {
        attr.range = attr.range ?? {};
        attr.range.min = {
          mode: "auto",
          scope: "layer_date",
          manual: 0,
          lastAuto: null,
        };
        changed = true;
      }
      if (!attr.range?.max) {
        attr.range = attr.range ?? {};
        attr.range.max = {
          mode: "auto",
          scope: "layer_date",
          manual: 1,
          lastAuto: null,
        };
        changed = true;
      }

      // Compat: si venía mode guardando scope (viejo)
      // Ej: attr.range.min.mode === "layer_date"
      const mMin = attr.range.min?.mode;
      if (
        mMin === "layer_date" ||
        mMin === "layer_all" ||
        mMin === "field_date" ||
        mMin === "field_all"
      ) {
        attr.range.min.mode = "auto";
        attr.range.min.scope = mMin;
        changed = true;
      }
      const mMax = attr.range.max?.mode;
      if (
        mMax === "layer_date" ||
        mMax === "layer_all" ||
        mMax === "field_date" ||
        mMax === "field_all"
      ) {
        attr.range.max.mode = "auto";
        attr.range.max.scope = mMax;
        changed = true;
      }

      // coercion final
      attr.range.min.mode =
        attr.range.min.mode === "manual" ? "manual" : "auto";
      attr.range.max.mode =
        attr.range.max.mode === "manual" ? "manual" : "auto";

      attr.range.min.scope = coerceScope(attr.range.min.scope);
      attr.range.max.scope = coerceScope(attr.range.max.scope);

      // manual numbers sanity
      if (!Number.isFinite(attr.range.min.manual)) {
        attr.range.min.manual = 0;
        changed = true;
      }
      if (!Number.isFinite(attr.range.max.manual)) {
        attr.range.max.manual = 1;
        changed = true;
      }
    };

    ensureAttr(next.axisColorAttr);
    ensureAttr(next.axisWidthAttr);
    ensureAttr(next.axisOpacityAttr);

    if (changed) onChangeStyle(next);
  }, [tabActive, axisEnabled, firstVar, style, onChangeStyle]);

  // -----------------------------
  // Resolver lastAuto por extremo usando scope del extremo
  // -----------------------------
  useEffect(() => {
    if (!tabActive || !axisEnabled) return;

    let changed = false;
    const next = structuredClone(style);

    const applyLastAuto = (attr: any) => {
      if (!attr?.enabled) return;
      const v = attr.variable ?? null;
      if (!v) return;

      // MIN auto
      if (attr.range?.min?.mode !== "manual") {
        const scopeMin: ElipsesNormalizationScope = coerceScope(
          attr.range?.min?.scope,
        );
        const rangesMin = pickRangesForScope(scopeMin, axisNormByScope);
        const autoMin = getAutoRangeForVariable(rangesMin, v).min;
        const val =
          typeof autoMin === "number" && Number.isFinite(autoMin)
            ? autoMin
            : null;

        if (!sameNumber(attr.range.min.lastAuto ?? null, val)) {
          attr.range.min.lastAuto = val;
          changed = true;
        }
      }

      // MAX auto
      if (attr.range?.max?.mode !== "manual") {
        const scopeMax: ElipsesNormalizationScope = coerceScope(
          attr.range?.max?.scope,
        );
        const rangesMax = pickRangesForScope(scopeMax, axisNormByScope);
        const autoMax = getAutoRangeForVariable(rangesMax, v).max;
        const val =
          typeof autoMax === "number" && Number.isFinite(autoMax)
            ? autoMax
            : null;

        if (!sameNumber(attr.range.max.lastAuto ?? null, val)) {
          attr.range.max.lastAuto = val;
          changed = true;
        }
      }
    };

    applyLastAuto(next.axisColorAttr);
    applyLastAuto(next.axisWidthAttr);
    applyLastAuto(next.axisOpacityAttr);

    if (changed) onChangeStyle(next);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tabActive,
    axisEnabled,

    axisNormByScope.layer_date.ranges,
    axisNormByScope.layer_all.ranges,
    axisNormByScope.field_date.ranges,
    axisNormByScope.field_all.ranges,

    style.axisColorAttr,
    style.axisWidthAttr,
    style.axisOpacityAttr,
  ]);

  return {
    axisEnabled,
    axisNormByScope,
  };
}
