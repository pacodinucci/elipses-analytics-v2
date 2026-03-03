// src/components/mapa/elipses-options/fill/use-fill-tab.tsx
import { useEffect, useMemo } from "react";
import type {
  ElipsesNormalizationRanges,
  ElipsesNormalizationScope,
  ElipsesStyle,
} from "../../../../store/elipses-style";
import {
  useElipsesNormalization,
  getAutoRangeForVariable,
} from "../../../../hooks/use-elipses-normalization";

export type FillNormByScope = Record<
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
  byScope: FillNormByScope,
): ElipsesNormalizationRanges {
  return byScope[scope]?.ranges ?? {};
}

export function useFillTab({
  tabActive,
  elipseVariables,

  style,
  onChangeStyle,

  // ✅ v2
  proyectoId,
  simulacionId,

  capaNombre,
  fecha,
}: {
  tabActive: boolean;
  elipseVariables: string[];

  style: ElipsesStyle;
  onChangeStyle: (s: ElipsesStyle) => void;

  proyectoId: string | null;
  simulacionId: string | null;

  capaNombre: string | null;
  fecha: string | null; // YYYY-MM-DD
}) {
  const fillEnabled = !!style.fillEnabled;
  const firstVar = elipseVariables[0] ?? null;

  // -----------------------------
  // Normalización DB (4 scopes)
  // -----------------------------
  const baseArgs = useMemo(
    () => ({
      proyectoId: tabActive ? proyectoId : null,
      simulacionId: tabActive ? simulacionId : null,
      capaNombre: tabActive ? capaNombre : null,
      fecha: tabActive ? fecha : null,

      // 🧯 compat temporal (solo si tu hook todavía lo pide):
      // yacimientoId: tabActive ? (proyectoId ?? null) : null,
    }),
    [tabActive, proyectoId, simulacionId, capaNombre, fecha],
  );

  const norm_layer_date = useElipsesNormalization({
    ...baseArgs,
    scope: "layer_date",
  } as any);
  const norm_layer_all = useElipsesNormalization({
    ...baseArgs,
    scope: "layer_all",
  } as any);
  const norm_field_date = useElipsesNormalization({
    ...baseArgs,
    scope: "field_date",
  } as any);
  const norm_field_all = useElipsesNormalization({
    ...baseArgs,
    scope: "field_all",
  } as any);

  const fillNormByScope: FillNormByScope = useMemo(
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
    if (!tabActive || !fillEnabled || !firstVar) return;

    let changed = false;
    const next = structuredClone(style);

    const ensureAttr = (
      attr: any,
      manualMinDefault = 0,
      manualMaxDefault = 1,
    ) => {
      if (!attr?.enabled) return;

      if (!attr.variable) {
        attr.variable = firstVar;
        changed = true;
      }

      if (!attr.range?.min) {
        attr.range = attr.range ?? {};
        attr.range.min = {
          mode: "auto",
          scope: "layer_date",
          manual: manualMinDefault,
          lastAuto: null,
        };
        changed = true;
      }
      if (!attr.range?.max) {
        attr.range = attr.range ?? {};
        attr.range.max = {
          mode: "auto",
          scope: "layer_date",
          manual: manualMaxDefault,
          lastAuto: null,
        };
        changed = true;
      }

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

      attr.range.min.mode =
        attr.range.min.mode === "manual" ? "manual" : "auto";
      attr.range.max.mode =
        attr.range.max.mode === "manual" ? "manual" : "auto";

      attr.range.min.scope = coerceScope(attr.range.min.scope);
      attr.range.max.scope = coerceScope(attr.range.max.scope);

      if (!Number.isFinite(attr.range.min.manual)) {
        attr.range.min.manual = manualMinDefault;
        changed = true;
      }
      if (!Number.isFinite(attr.range.max.manual)) {
        attr.range.max.manual = manualMaxDefault;
        changed = true;
      }
    };

    ensureAttr(next.fillColorAttr, 0, 1);
    ensureAttr(next.fillOpacityAttr, 0, 1);

    if (changed) onChangeStyle(next);
  }, [tabActive, fillEnabled, firstVar, style, onChangeStyle]);

  // -----------------------------
  // Resolver lastAuto por extremo usando scope del extremo
  // -----------------------------
  useEffect(() => {
    if (!tabActive || !fillEnabled) return;

    let changed = false;
    const next = structuredClone(style);

    const applyLastAuto = (attr: any) => {
      if (!attr?.enabled) return;
      const v = attr.variable ?? null;
      if (!v) return;

      if (attr.range?.min?.mode !== "manual") {
        const scopeMin: ElipsesNormalizationScope = coerceScope(
          attr.range?.min?.scope,
        );
        const rangesMin = pickRangesForScope(scopeMin, fillNormByScope);
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

      if (attr.range?.max?.mode !== "manual") {
        const scopeMax: ElipsesNormalizationScope = coerceScope(
          attr.range?.max?.scope,
        );
        const rangesMax = pickRangesForScope(scopeMax, fillNormByScope);
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

    applyLastAuto(next.fillColorAttr);
    applyLastAuto(next.fillOpacityAttr);

    if (changed) onChangeStyle(next);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tabActive,
    fillEnabled,

    fillNormByScope.layer_date.ranges,
    fillNormByScope.layer_all.ranges,
    fillNormByScope.field_date.ranges,
    fillNormByScope.field_all.ranges,

    style.fillColorAttr,
    style.fillOpacityAttr,
  ]);

  return {
    fillEnabled,
    fillNormByScope,
  };
}
