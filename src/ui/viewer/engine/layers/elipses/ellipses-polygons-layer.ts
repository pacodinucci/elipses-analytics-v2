// src/viewer/engine/layers/elipses/ellipses-polygons-layer.ts
import * as PIXI from "pixi.js";
import type { ViewportRect } from "../../../types";
import type { Camera2D } from "../../camera/camera-2d";

export type ElipseRow = {
  id_elipse: string;
  capa: string;
  inyector: string;
  productor: string;
  x: number[];
  y: number[];
  variables: Record<string, Record<string, number>>;
};

export type EllipsesNormalizationRanges = Record<
  string,
  { min: number | null; max: number | null }
>;

export type EllipsesNormalizationPayload = {
  ranges: EllipsesNormalizationRanges;
  scope?: string | null;
  context?: any | null;
};

export type RangeMode = "auto" | "manual";

export type AxisColorChannel = {
  mode: "fixed" | "variable";
  fixedColor?: string; // "#RRGGBB"
  minColor?: string; // "#RRGGBB"
  maxColor?: string; // "#RRGGBB"
  variable?: string | null;

  // ✅ rango de normalización para color (dato) (auto/manual)
  rangeMode?: RangeMode;

  // ✅ overrides (si están presentes, deben poder usarse incluso en auto)
  valueMin?: number;
  valueMax?: number;
};

export type AxisScalarChannel = {
  variable?: string | null;

  // ✅ rango de normalización para scalar (dato) (auto/manual)
  rangeMode?: RangeMode;

  // ✅ overrides (si están presentes, deben poder usarse incluso en auto)
  valueMin?: number;
  valueMax?: number;

  // ✅ (opcional) rango visual para el canal (ej: width px, alpha 0..1)
  minWidth?: number;
  maxWidth?: number;
  minAlpha?: number;
  maxAlpha?: number;
};

export type AxisChannelsConfig = {
  enabled: boolean;

  // escala/constante de color
  color: AxisColorChannel;

  // escala para width/alpha (cada uno con su variable propia)
  width: AxisScalarChannel;
  alpha: AxisScalarChannel;
};

// ✅ Fill: no tiene width
export type FillChannelsConfig = {
  enabled: boolean;
  color: AxisColorChannel;
  alpha: AxisScalarChannel;
};

export type EllipsesPolygonStyle = {
  // --------------------
  // CONTORNO (legacy)
  // --------------------
  strokeEnabled: boolean;
  strokeColor: string; // "#RRGGBB"
  strokeWidth: number; // px (base)
  strokeMinAlpha: number; // 0..1
  strokeMaxAlpha: number; // 0..1

  // --------------------
  // RELLENO (legacy)
  // --------------------
  fillEnabled: boolean;
  fillColor: string; // "#RRGGBB"
  fillMinAlpha: number; // 0..1
  fillMaxAlpha: number; // 0..1

  // --------------------
  // EJE (legacy - se mantiene)
  // --------------------
  axisEnabled: boolean;
  axisColor: string; // "#RRGGBB"
  axisMinWidth: number; // px
  axisMaxWidth: number; // px
  axisMinAlpha: number; // 0..1
  axisMaxAlpha: number; // 0..1

  /**
   * ✅ NUEVO (Camino B): canales independientes del eje.
   */
  axisChannels?: AxisChannelsConfig;

  /**
   * ✅ NUEVO: canales independientes del contorno (stroke).
   */
  strokeChannels?: AxisChannelsConfig;

  /**
   * ✅ NUEVO: canales independientes del relleno (fill).
   */
  fillChannels?: FillChannelsConfig;
};

const DEFAULT_STYLE: EllipsesPolygonStyle = {
  strokeEnabled: true,
  strokeColor: "#ff00ff",
  strokeWidth: 1,
  strokeMinAlpha: 0.2,
  strokeMaxAlpha: 1,

  fillEnabled: false,
  fillColor: "#ff00ff",
  fillMinAlpha: 0.05,
  fillMaxAlpha: 0.4,

  axisEnabled: true,
  axisColor: "#000000",
  axisMinWidth: 0.5,
  axisMaxWidth: 3,
  axisMinAlpha: 0.2,
  axisMaxAlpha: 1,
};

function hexToNumber(hex: string): number {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return 0x000000;
  return parseInt(h, 16);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clamp(v: number, mn: number, mx: number): number {
  return Math.max(mn, Math.min(mx, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColorHex(c0: string, c1: string, t: number): string {
  const a = hexToNumber(c0);
  const b = hexToNumber(c1);

  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;

  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;

  const rr = Math.round(lerp(ar, br, t));
  const gg = Math.round(lerp(ag, bg, t));
  const bb2 = Math.round(lerp(ab, bb, t));

  const n = (rr << 16) | (gg << 8) | bb2;
  return `#${n.toString(16).padStart(6, "0")}`;
}

/**
 * Polos: par de puntos con mayor distancia (criterio Plotly).
 */
function getEllipsePoles(
  x: number[],
  y: number[],
): { x1: number; y1: number; x2: number; y2: number } | null {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;

  let maxD2 = -Infinity;
  let iMax = 0;
  let jMax = 1;

  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    for (let j = i + 1; j < n; j++) {
      const dx = xi - x[j];
      const dy = yi - y[j];
      const d2 = dx * dx + dy * dy;
      if (d2 > maxD2) {
        maxD2 = d2;
        iMax = i;
        jMax = j;
      }
    }
  }

  if (!Number.isFinite(maxD2) || maxD2 <= 0) return null;

  return {
    x1: x[iMax],
    y1: y[iMax],
    x2: x[jMax],
    y2: y[jMax],
  };
}

// ✅ keys por canal
type AxisChannelKey = "axis_color" | "axis_width" | "axis_alpha";
type StrokeChannelKey = "stroke_color" | "stroke_width" | "stroke_alpha";
type FillChannelKey = "fill_color" | "fill_alpha";

type AxisNormalizationPartial = Partial<{
  color: EllipsesNormalizationPayload | null;
  width: EllipsesNormalizationPayload | null;
  alpha: EllipsesNormalizationPayload | null;
}>;

type FillNormalizationPartial = Partial<{
  color: EllipsesNormalizationPayload | null;
  alpha: EllipsesNormalizationPayload | null;
}>;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isValidHistoricalValue(v: unknown): v is number {
  // ✅ tu regla: válido si es finito y distinto de 0
  return typeof v === "number" && Number.isFinite(v) && v !== 0;
}

/**
 * Busca "último valor válido" (≠0, finito) en fechas <= selectedDate.
 * Asume claves ISO "YYYY-MM-DD" -> comparación lexicográfica funciona.
 */
function lastValidValueUpToDate(
  dateMap: Record<string, number> | undefined,
  selectedDate: string,
): number | null {
  if (!dateMap) return null;

  // ✅ fast-path: si en la fecha actual ya es válido, devolvemos sin recorrer
  const direct = (dateMap as any)[selectedDate];
  if (isValidHistoricalValue(direct)) return direct;

  let bestDate: string | null = null;
  let bestValue: number | null = null;

  // recorremos sin ordenar (O(n)); suficiente para mensual / pocos puntos
  for (const k in dateMap) {
    if (!Object.prototype.hasOwnProperty.call(dateMap, k)) continue;
    if (k > selectedDate) continue;

    const v = (dateMap as any)[k];
    if (!isValidHistoricalValue(v)) continue;

    if (bestDate == null || k > bestDate) {
      bestDate = k;
      bestValue = v;
    }
  }

  return bestValue;
}

export class EllipsesPolygonsLayer {
  private app: PIXI.Application;
  private vp: ViewportRect = { width: 1, height: 1 };

  private container: PIXI.Container;

  private data: ElipseRow[] = [];
  private byId = new Map<string, PIXI.Graphics>();
  private style: EllipsesPolygonStyle = { ...DEFAULT_STYLE };
  private visible = true;

  private selectedDate: string | null = null;
  private selectedVariable: string | null = null;

  // ✅ NUEVO: modo histórico (último valor válido hacia atrás)
  private showHistorical = false;

  // ✅ rangos actualmente usados para normalizar "selectedVariable" (legacy)
  private valueMin: number | null = null;
  private valueMax: number | null = null;

  // ✅ rangos provenientes de DB (scope) (legacy). Si existe range para variable, tiene prioridad.
  private normalization: EllipsesNormalizationPayload = { ranges: {} };

  /**
   * ✅ NORMALIZACIÓN ÚNICA DEL EJE:
   * Color/Width/Alpha comparten el MISMO set de ranges.
   */
  private axisNormalization: EllipsesNormalizationPayload = {
    ranges: {},
    scope: null,
    context: null,
  };

  /**
   * ✅ NORMALIZACIÓN ÚNICA DEL CONTORNO (stroke):
   * Color/Width/Alpha comparten el MISMO set de ranges.
   */
  private strokeNormalization: EllipsesNormalizationPayload = {
    ranges: {},
    scope: null,
    context: null,
  };

  /**
   * ✅ NORMALIZACIÓN ÚNICA DEL RELLENO (fill):
   * Color/Alpha comparten el MISMO set de ranges.
   */
  private fillNormalization: EllipsesNormalizationPayload = {
    ranges: {},
    scope: null,
    context: null,
  };

  constructor(app: PIXI.Application) {
    this.app = app;
    this.app.stage.sortableChildren = true;

    this.container = new PIXI.Container();
    this.container.zIndex = 20;
    this.app.stage.addChild(this.container);
  }

  setViewport(vp: ViewportRect) {
    this.vp = vp;
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.container.visible = v;
  }

  setStyle(style: Partial<EllipsesPolygonStyle>) {
    this.style = { ...this.style, ...style };
    this.rebuildGraphics();
  }

  setData(elipses: ElipseRow[]) {
    this.data = elipses ?? [];
    this.recomputeRange();
    this.rebuildGraphics();
  }

  setContext(ctx: {
    selectedDate: string | null;
    selectedVariable: string | null;
    showHistorical?: boolean;
  }) {
    this.selectedDate = ctx.selectedDate;
    this.selectedVariable = ctx.selectedVariable;

    if (typeof ctx.showHistorical === "boolean") {
      this.showHistorical = ctx.showHistorical;
    }

    this.recomputeRange();
  }

  /**
   * ✅ Legacy/global normalization (para selectedVariable)
   */
  setNormalization(payload: EllipsesNormalizationPayload) {
    this.normalization = {
      ranges: payload?.ranges ?? {},
      scope: payload?.scope ?? null,
      context: payload?.context ?? null,
    };
    this.recomputeRange();
  }

  // ------------------------
  // Axis normalization
  // ------------------------
  setAxisNormalization(payload: AxisNormalizationPartial) {
    const p = payload.color ?? payload.width ?? payload.alpha ?? null;
    if (!p) return;

    this.axisNormalization = {
      ranges: p.ranges ?? {},
      scope: p.scope ?? null,
      context: p.context ?? null,
    };
  }

  setAxisColorNormalization(payload: EllipsesNormalizationPayload) {
    this.axisNormalization = {
      ranges: payload?.ranges ?? {},
      scope: payload?.scope ?? null,
      context: payload?.context ?? null,
    };
  }
  setAxisWidthNormalization(payload: EllipsesNormalizationPayload) {
    this.setAxisColorNormalization(payload);
  }
  setAxisAlphaNormalization(payload: EllipsesNormalizationPayload) {
    this.setAxisColorNormalization(payload);
  }

  // ------------------------
  // Stroke normalization
  // ------------------------
  setContourNormalization(payload: AxisNormalizationPartial) {
    const p = payload.color ?? payload.width ?? payload.alpha ?? null;
    if (!p) return;

    this.strokeNormalization = {
      ranges: p.ranges ?? {},
      scope: p.scope ?? null,
      context: p.context ?? null,
    };
  }

  setStrokeColorNormalization(payload: EllipsesNormalizationPayload) {
    this.strokeNormalization = {
      ranges: payload?.ranges ?? {},
      scope: payload?.scope ?? null,
      context: payload?.context ?? null,
    };
  }
  setStrokeWidthNormalization(payload: EllipsesNormalizationPayload) {
    this.setStrokeColorNormalization(payload);
  }
  setStrokeAlphaNormalization(payload: EllipsesNormalizationPayload) {
    this.setStrokeColorNormalization(payload);
  }

  // ------------------------
  // Fill normalization ✅
  // ------------------------
  setFillNormalization(payload: FillNormalizationPartial) {
    const p = payload.color ?? payload.alpha ?? null;
    if (!p) return;

    this.fillNormalization = {
      ranges: p.ranges ?? {},
      scope: p.scope ?? null,
      context: p.context ?? null,
    };
  }

  setFillColorNormalization(payload: EllipsesNormalizationPayload) {
    this.fillNormalization = {
      ranges: payload?.ranges ?? {},
      scope: payload?.scope ?? null,
      context: payload?.context ?? null,
    };
  }
  setFillAlphaNormalization(payload: EllipsesNormalizationPayload) {
    this.setFillColorNormalization(payload);
  }

  clear() {
    this.setData([]);
  }

  private rebuildGraphics() {
    for (const g of this.byId.values()) g.destroy();
    this.byId.clear();
    this.container.removeChildren();

    if (!this.visible) return;
    if (!this.data.length) return;

    for (const e of this.data) {
      const g = new PIXI.Graphics();
      (g as any).__id = e.id_elipse;
      this.byId.set(e.id_elipse, g);
      this.container.addChild(g);
    }
  }

  /**
   * Decide el rango de normalización (legacy):
   * 1) Si hay rango DB para selectedVariable => usarlo.
   * 2) Si no => rango local sobre el dataset actual y selectedDate.
   */
  private recomputeRange() {
    const vName = this.selectedVariable;
    const dKey = this.selectedDate;

    if (!vName || !dKey || !this.data.length) {
      this.valueMin = null;
      this.valueMax = null;
      return;
    }

    const dbRange = this.normalization?.ranges?.[vName];
    if (dbRange && typeof dbRange === "object") {
      const mn = dbRange.min;
      const mx = dbRange.max;

      const mnOk = typeof mn === "number" && Number.isFinite(mn);
      const mxOk = typeof mx === "number" && Number.isFinite(mx);

      if (mnOk && mxOk) {
        this.valueMin = mn;
        this.valueMax = mx;
        return;
      }
    }

    let mn = Infinity;
    let mx = -Infinity;

    for (const e of this.data) {
      const v = this.getEllipseValueByName(e, vName);
      if (v == null) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }

    this.valueMin = mn === Infinity ? null : mn;
    this.valueMax = mx === -Infinity ? null : mx;
  }

  /**
   * ✅ Valor "efectivo" por variable:
   * - si showHistorical=false: usa valor directo en selectedDate
   * - si showHistorical=true: usa "último valor válido" (≠0, finito) hacia atrás <= selectedDate
   */
  private getEllipseValueByName(e: ElipseRow, vName: string): number | null {
    const dKey = this.selectedDate;
    if (!vName || !dKey) return null;

    const dateMap = e.variables?.[vName];
    if (!dateMap) return null;

    if (!this.showHistorical) {
      const v = (dateMap as any)[dKey];
      return isValidHistoricalValue(v) ? v : null;
    }

    return lastValidValueUpToDate(dateMap, dKey);
  }

  private getLegacyValue(e: ElipseRow): number | null {
    const vName = this.selectedVariable;
    if (!vName) return null;
    return this.getEllipseValueByName(e, vName);
  }

  /**
   * ✅ Normaliza robusto + SATURA.
   */
  private normalizeWithRange(v: number, mn: number | null, mx: number | null) {
    if (mn == null || mx == null) return 0.5;

    let a = mn;
    let b = mx;

    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(v)) {
      return 0.5;
    }

    if (b < a) {
      const tmp = a;
      a = b;
      b = tmp;
    }

    if (b === a) return 0.5;

    const vv = clamp(v, a, b);
    return clamp01((vv - a) / (b - a));
  }

  private getNormalizationRangesForAxisChannel(
    _channel: AxisChannelKey,
  ): EllipsesNormalizationRanges {
    return this.axisNormalization.ranges ?? {};
  }

  private getNormalizationRangesForStrokeChannel(
    _channel: StrokeChannelKey,
  ): EllipsesNormalizationRanges {
    return this.strokeNormalization.ranges ?? {};
  }

  private getNormalizationRangesForFillChannel(
    _channel: FillChannelKey,
  ): EllipsesNormalizationRanges {
    return this.fillNormalization.ranges ?? {};
  }

  private resolveAutoRangeForVariable(
    vName: string | null,
    channel:
      | "legacy"
      | AxisChannelKey
      | StrokeChannelKey
      | FillChannelKey = "legacy",
  ): { min: number | null; max: number | null } {
    if (!vName || !this.selectedDate || !this.data.length) {
      return { min: null, max: null };
    }

    const ranges =
      channel === "legacy"
        ? (this.normalization?.ranges ?? {})
        : channel.startsWith("axis_")
          ? this.getNormalizationRangesForAxisChannel(channel as AxisChannelKey)
          : channel.startsWith("stroke_")
            ? this.getNormalizationRangesForStrokeChannel(
                channel as StrokeChannelKey,
              )
            : this.getNormalizationRangesForFillChannel(
                channel as FillChannelKey,
              );

    const dbRange = ranges?.[vName];
    if (dbRange && typeof dbRange === "object") {
      const mn = dbRange.min;
      const mx = dbRange.max;
      const mnOk = typeof mn === "number" && Number.isFinite(mn);
      const mxOk = typeof mx === "number" && Number.isFinite(mx);
      if (mnOk && mxOk) return { min: mn, max: mx };
    }

    let mn = Infinity;
    let mx = -Infinity;

    for (const e of this.data) {
      const v = this.getEllipseValueByName(e, vName);
      if (v == null) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }

    return {
      min: mn === Infinity ? null : mn,
      max: mx === -Infinity ? null : mx,
    };
  }

  /**
   * ✅ Resuelve t para un canal:
   * - manual: usa valueMin/valueMax
   * - auto: SI trae valueMin/valueMax válidos, los usa como override (clave para min/max por scope extremo)
   *         si no, cae al auto por ranges del channelKey
   */
  private resolveChannelT(
    e: ElipseRow,
    channel: AxisScalarChannel | AxisColorChannel,
    channelKey: AxisChannelKey | StrokeChannelKey | FillChannelKey,
  ): number {
    const vName = channel.variable ?? null;
    if (!vName) return 0.5;

    const raw = this.getEllipseValueByName(e, vName);
    if (raw == null) return 0.5;

    const mode: RangeMode = (channel as any).rangeMode ?? "auto";

    const hasOverride =
      isFiniteNumber((channel as any).valueMin) &&
      isFiniteNumber((channel as any).valueMax);

    // ✅ manual siempre usa override
    if (mode === "manual") {
      const mn = hasOverride ? (channel as any).valueMin : null;
      const mx = hasOverride ? (channel as any).valueMax : null;
      return this.normalizeWithRange(raw, mn, mx);
    }

    // ✅ auto: si hay override (ej: min/max calculados por scopes distintos), usarlo
    if (hasOverride) {
      return this.normalizeWithRange(
        raw,
        (channel as any).valueMin,
        (channel as any).valueMax,
      );
    }

    // fallback: auto por normalization ranges
    const r = this.resolveAutoRangeForVariable(vName, channelKey);
    return this.normalizeWithRange(raw, r.min, r.max);
  }

  render(camera: Camera2D) {
    if (!this.visible) return;
    if (!this.data.length) return;

    const st = this.style;
    const hasLegacyContext = !!this.selectedDate && !!this.selectedVariable;

    for (const e of this.data) {
      const g = this.byId.get(e.id_elipse);
      if (!g) continue;

      g.clear();

      const xs = e.x ?? [];
      const ys = e.y ?? [];
      const n = Math.min(xs.length, ys.length);
      if (n < 3) continue;

      const rawLegacy = this.getLegacyValue(e);
      if (hasLegacyContext && rawLegacy == null) continue;

      const tLegacy =
        rawLegacy == null
          ? 0.5
          : this.normalizeWithRange(rawLegacy, this.valueMin, this.valueMax);

      // --------------------
      // RELLENO (nuevo si fillChannels existe) ✅
      // --------------------
      let didBeginFill = false;
      const fillCfg = st.fillChannels;

      if (fillCfg && fillCfg.enabled) {
        const tA = this.resolveChannelT(e, fillCfg.alpha, "fill_alpha");

        const minA =
          typeof (fillCfg.alpha as any).minAlpha === "number" &&
          Number.isFinite((fillCfg.alpha as any).minAlpha)
            ? (fillCfg.alpha as any).minAlpha
            : st.fillMinAlpha;

        const maxA =
          typeof (fillCfg.alpha as any).maxAlpha === "number" &&
          Number.isFinite((fillCfg.alpha as any).maxAlpha)
            ? (fillCfg.alpha as any).maxAlpha
            : st.fillMaxAlpha;

        const fillAlpha = clamp01(lerp(minA, maxA, tA));

        if (fillAlpha > 0) {
          let fillColorHex = fillCfg.color.fixedColor ?? st.fillColor;

          if (fillCfg.color.mode === "variable") {
            const tC = this.resolveChannelT(e, fillCfg.color, "fill_color");
            const c0 = fillCfg.color.minColor ?? "#0000ff";
            const c1 = fillCfg.color.maxColor ?? "#ff9900";
            fillColorHex = lerpColorHex(c0, c1, tC);
          }

          g.beginFill(hexToNumber(fillColorHex), fillAlpha);
          didBeginFill = true;
        }
      } else {
        // --------------------
        // RELLENO (legacy)
        // --------------------
        const fillAlpha = st.fillEnabled
          ? clamp01(lerp(st.fillMinAlpha, st.fillMaxAlpha, tLegacy))
          : 0;

        if (st.fillEnabled && fillAlpha > 0) {
          g.beginFill(hexToNumber(st.fillColor), fillAlpha);
          didBeginFill = true;
        }
      }

      // --------------------
      // CONTORNO (nuevo si strokeChannels existe)
      // --------------------
      const strokeCfg = st.strokeChannels;

      if (strokeCfg && strokeCfg.enabled) {
        const tW = this.resolveChannelT(e, strokeCfg.width, "stroke_width");
        const tA = this.resolveChannelT(e, strokeCfg.alpha, "stroke_alpha");

        const minW =
          typeof (strokeCfg.width as any).minWidth === "number" &&
          Number.isFinite((strokeCfg.width as any).minWidth)
            ? (strokeCfg.width as any).minWidth
            : st.strokeWidth;

        const maxW =
          typeof (strokeCfg.width as any).maxWidth === "number" &&
          Number.isFinite((strokeCfg.width as any).maxWidth)
            ? (strokeCfg.width as any).maxWidth
            : st.strokeWidth;

        const minA =
          typeof (strokeCfg.alpha as any).minAlpha === "number" &&
          Number.isFinite((strokeCfg.alpha as any).minAlpha)
            ? (strokeCfg.alpha as any).minAlpha
            : st.strokeMinAlpha;

        const maxA =
          typeof (strokeCfg.alpha as any).maxAlpha === "number" &&
          Number.isFinite((strokeCfg.alpha as any).maxAlpha)
            ? (strokeCfg.alpha as any).maxAlpha
            : st.strokeMaxAlpha;

        const strokeAlpha = clamp01(lerp(minA, maxA, tA));
        const strokeWidth = Math.max(0.1, lerp(minW, maxW, tW));

        let strokeColorHex = strokeCfg.color.fixedColor ?? st.strokeColor;

        if (strokeCfg.color.mode === "variable") {
          const tC = this.resolveChannelT(e, strokeCfg.color, "stroke_color");
          const c0 = strokeCfg.color.minColor ?? "#0000ff";
          const c1 = strokeCfg.color.maxColor ?? "#ff9900";
          strokeColorHex = lerpColorHex(c0, c1, tC);
        }

        if (strokeAlpha > 0) {
          g.lineStyle(strokeWidth, hexToNumber(strokeColorHex), strokeAlpha);
        } else {
          g.lineStyle(0);
        }
      } else {
        // CONTORNO (legacy)
        const strokeAlpha = st.strokeEnabled
          ? clamp01(lerp(st.strokeMinAlpha, st.strokeMaxAlpha, tLegacy))
          : 0;

        if (st.strokeEnabled && strokeAlpha > 0) {
          g.lineStyle(
            Math.max(0.1, st.strokeWidth),
            hexToNumber(st.strokeColor),
            strokeAlpha,
          );
        } else {
          g.lineStyle(0);
        }
      }

      const p0 = camera.worldToScreen({ x: xs[0], y: ys[0] }, this.vp);
      g.moveTo(p0.x, p0.y);

      for (let i = 1; i < n; i++) {
        const pi = camera.worldToScreen({ x: xs[i], y: ys[i] }, this.vp);
        g.lineTo(pi.x, pi.y);
      }

      g.lineTo(p0.x, p0.y);

      if (didBeginFill) {
        g.endFill();
      }

      // --------------------
      // EJE (nuevo si axisChannels existe)
      // --------------------
      const axisCfg = st.axisChannels;

      if (axisCfg && axisCfg.enabled) {
        const poles = getEllipsePoles(xs, ys);
        if (poles) {
          const tW = this.resolveChannelT(e, axisCfg.width, "axis_width");
          const tA = this.resolveChannelT(e, axisCfg.alpha, "axis_alpha");

          const axisAlpha = clamp01(lerp(st.axisMinAlpha, st.axisMaxAlpha, tA));
          const axisWidth = Math.max(
            0.1,
            lerp(st.axisMinWidth, st.axisMaxWidth, tW),
          );

          if (axisAlpha > 0) {
            let axisColorHex = axisCfg.color.fixedColor ?? st.axisColor;

            if (axisCfg.color.mode === "variable") {
              const tC = this.resolveChannelT(e, axisCfg.color, "axis_color");
              const c0 = axisCfg.color.minColor ?? "#0000ff";
              const c1 = axisCfg.color.maxColor ?? "#ff9900";
              axisColorHex = lerpColorHex(c0, c1, tC);
            }

            g.lineStyle(axisWidth, hexToNumber(axisColorHex), axisAlpha);

            const a = camera.worldToScreen(
              { x: poles.x1, y: poles.y1 },
              this.vp,
            );
            const b = camera.worldToScreen(
              { x: poles.x2, y: poles.y2 },
              this.vp,
            );

            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
          }
        }

        continue;
      }

      // --------------------
      // EJE (legacy fallback)
      // --------------------
      if (st.axisEnabled) {
        const poles = getEllipsePoles(xs, ys);
        if (poles) {
          const axisAlpha = clamp01(
            lerp(st.axisMinAlpha, st.axisMaxAlpha, tLegacy),
          );
          const axisWidth = Math.max(
            0.1,
            lerp(st.axisMinWidth, st.axisMaxWidth, tLegacy),
          );

          if (axisAlpha > 0) {
            g.lineStyle(axisWidth, hexToNumber(st.axisColor), axisAlpha);

            const a = camera.worldToScreen(
              { x: poles.x1, y: poles.y1 },
              this.vp,
            );
            const b = camera.worldToScreen(
              { x: poles.x2, y: poles.y2 },
              this.vp,
            );

            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
          }
        }
      }
    }
  }

  destroy() {
    for (const g of this.byId.values()) g.destroy();
    this.byId.clear();
    this.container.destroy({ children: true });
  }
}
