import type { HeatmapStyle } from "../../../../store/heatmap-style";

type RGB = { r: number; g: number; b: number };
export type Stop = { t: number; rgb: RGB };

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const tt = clamp01(t);
  return {
    r: Math.round(lerp(a.r, b.r, tt)),
    g: Math.round(lerp(a.g, b.g, tt)),
    b: Math.round(lerp(a.b, b.b, tt)),
  };
}

export function opacityColor(style: HeatmapStyle): RGB {
  return hexToRgb(style.opacityColor || "#000000") ?? { r: 0, g: 0, b: 0 };
}

/**
 * Replica tu idea de buildColorscale:
 * - fillMode=opacity -> se maneja aparte (no devuelve stops)
 * - valueRangeMode=auto -> usa primer/último stop (si existen)
 * - manual -> usa stops completos normalizados
 */
export function buildStops(
  dataMin: number,
  dataMax: number,
  style: HeatmapStyle,
): Stop[] {
  if (style.fillMode === "opacity") return [];

  const span = dataMax - dataMin || 1;

  if (style.valueRangeMode === "auto") {
    const stops = style.customStops ?? [];
    if (stops.length === 0) {
      return [
        { t: 0, rgb: { r: 0, g: 0, b: 0 } },
        { t: 1, rgb: { r: 255, g: 255, b: 255 } },
      ];
    }

    const first = stops[0];
    const last = stops[stops.length - 1];
    return [
      { t: 0, rgb: hexToRgb(first.color) ?? { r: 0, g: 0, b: 0 } },
      { t: 1, rgb: hexToRgb(last.color) ?? { r: 255, g: 255, b: 255 } },
    ];
  }

  const sorted = [...(style.customStops ?? [])].sort(
    (a, b) => a.value - b.value,
  );

  if (sorted.length === 0) {
    return [
      { t: 0, rgb: { r: 0, g: 0, b: 0 } },
      { t: 1, rgb: { r: 255, g: 255, b: 255 } },
    ];
  }

  return sorted.map((s) => ({
    t: clamp01((s.value - dataMin) / span),
    rgb: hexToRgb(s.color) ?? { r: 255, g: 0, b: 255 },
  }));
}

export function sampleStops(stops: Stop[], t: number): RGB {
  if (stops.length === 0) return { r: 0, g: 0, b: 0 };

  const tt = clamp01(t);

  if (tt <= stops[0].t) return stops[0].rgb;
  const last = stops[stops.length - 1];
  if (tt >= last.t) return last.rgb;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (tt >= a.t && tt <= b.t) {
      const span = b.t - a.t || 1;
      const u = (tt - a.t) / span;
      return lerpRgb(a.rgb, b.rgb, u);
    }
  }

  return last.rgb;
}
