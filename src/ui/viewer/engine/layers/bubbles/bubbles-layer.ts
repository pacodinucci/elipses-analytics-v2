// src/viewer/engine/layers/bubbles/bubbles-layer.ts
import * as PIXI from "pixi.js";
import type { ViewportRect } from "../../../types";
import type { Camera2D } from "../../camera/camera-2d";

/** Keys soportadas para porciones del pie (v2) */
export type BubblePieKey =
  | "petroleo"
  | "agua"
  | "gas"
  | "inyeccionAgua"
  | "inyeccionGas";

export type BubblePoint = {
  id: string;
  x: number;
  y: number;

  // value que gobierna radio/escala
  value: number | null;

  nombre?: string;

  // datos para render pie-chart
  pie?: Partial<Record<BubblePieKey, number>>;
};

export type RangeMode = "auto" | "manual";

export type BubbleValueDomain = {
  mode: RangeMode;
  min: number;
  max: number;
};

export type BubbleScaleMode = "linear" | "sqrt" | "log";
export type BubbleRenderMode = "circle" | "pie";

export type BubblesStyleConfig = {
  enabled: boolean;
  hideNull: boolean;

  // circle
  color: string; // "#RRGGBB"
  opacity: number; // 0..1
  borderWidth: number; // px
  borderColor: string; // "#RRGGBB"

  scaleMode: BubbleScaleMode;
  domain: BubbleValueDomain;

  minRadius: number;
  maxRadius: number;

  // pie
  renderMode?: BubbleRenderMode; // default: "circle"
  pieKeys?: BubblePieKey[];
  pieColors?: Partial<Record<BubblePieKey, string>>;
  pieMinTotal?: number;
  pieInnerRadiusRatio?: number; // 0..0.9
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function hexToNumber(hex: string): number {
  const h = String(hex ?? "")
    .replace("#", "")
    .trim();
  if (h.length !== 6) return 0x000000;
  const n = parseInt(h, 16);
  return Number.isFinite(n) ? n : 0x000000;
}

function computeAutoDomain(values: Array<number>): {
  min: number;
  max: number;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min, max: min + 1 };
  return { min, max };
}

function norm01(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  if (max <= min) return 0;
  return clamp((v - min) / (max - min), 0, 1);
}

function applyScaleMode(t: number, mode: BubbleScaleMode): number {
  const x = clamp(t, 0, 1);
  if (mode === "sqrt") return Math.sqrt(x);
  if (mode === "log") {
    const a = 9;
    return Math.log(1 + a * x) / Math.log(1 + a);
  }
  return x;
}

function valueToRadius(
  value: number,
  cfg: BubblesStyleConfig,
  domain: { min: number; max: number },
) {
  const t0 = norm01(value, domain.min, domain.max);
  const t = applyScaleMode(t0, cfg.scaleMode);
  const r0 = cfg.minRadius + (cfg.maxRadius - cfg.minRadius) * t;
  return Math.max(0, r0);
}

type CachedDraw = {
  r: number;
  bw: number;
  bc: number;

  // circle
  fill?: number;
  fillAlpha?: number;

  // mode
  mode?: BubbleRenderMode;

  // pie
  pieHash?: string;
};

// ✅ defaults PIE (v2)
const DEFAULT_PIE_KEYS: BubblePieKey[] = [
  "petroleo",
  "agua",
  "gas",
  "inyeccionAgua",
  "inyeccionGas",
];

const DEFAULT_PIE_COLORS: Record<BubblePieKey, string> = {
  petroleo: "#2b2b2b",
  agua: "#2f80ed",
  gas: "#f2c94c",
  inyeccionAgua: "#56ccf2",
  inyeccionGas: "#9b51e0",
};

function safeNumber(v: unknown): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  return v;
}

function buildPieSegments(
  p: BubblePoint,
  cfg: BubblesStyleConfig,
): Array<{ key: BubblePieKey; value: number; color: number }> {
  const keys = (cfg.pieKeys?.length ? cfg.pieKeys : DEFAULT_PIE_KEYS).slice();
  const colorsCfg = cfg.pieColors ?? {};
  const segs: Array<{ key: BubblePieKey; value: number; color: number }> = [];

  const pie = p.pie ?? undefined;
  if (!pie) return segs;

  for (const key of keys) {
    const v = safeNumber(pie[key]);
    if (v == null) continue;
    if (v <= 0) continue;

    const hex = String(colorsCfg[key] ?? DEFAULT_PIE_COLORS[key] ?? "#000000");
    segs.push({ key, value: v, color: hexToNumber(hex) });
  }

  return segs;
}

function pieHashForCache(args: {
  segs: Array<{ key: BubblePieKey; value: number; color: number }>;
  alpha: number;
  bw: number;
  bc: number;
  inner: number;
}) {
  const parts = args.segs
    .map((s) => `${s.key}:${s.value}:${s.color}`)
    .join("|");
  return `a=${args.alpha}|bw=${args.bw}|bc=${args.bc}|in=${args.inner}|${parts}`;
}

export class BubblesLayer {
  private app: PIXI.Application;
  private vp: ViewportRect = { width: 1, height: 1 };

  private container: PIXI.Container;

  private data: BubblePoint[] = [];

  // ✅ un Graphics por id (sirve para circle y para pie)
  private byId = new Map<string, PIXI.Graphics>();

  private drawCache = new Map<string, CachedDraw>();

  private cfg: BubblesStyleConfig | null = null;
  private resolvedDomain: { min: number; max: number } = { min: 0, max: 1 };

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

  setConfig(cfg: BubblesStyleConfig) {
    this.cfg = cfg;
    this.syncGraphics();
  }

  setData(data: BubblePoint[]) {
    this.data = data ?? [];
    this.syncGraphics();
  }

  clear() {
    this.setData([]);
  }

  setVisible(v: boolean) {
    this.container.visible = !!v;
  }

  private resolveDomain(cfg: BubblesStyleConfig): { min: number; max: number } {
    if (cfg.domain?.mode === "manual") {
      const min = Number.isFinite(cfg.domain.min) ? cfg.domain.min : 0;
      const maxRaw = Number.isFinite(cfg.domain.max) ? cfg.domain.max : min + 1;
      const max = maxRaw <= min ? min + 1 : maxRaw;
      return { min, max };
    }

    const values = this.data
      .map((d) => d.value)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return computeAutoDomain(values);
  }

  private ensureGraphic(id: string): PIXI.Graphics {
    const existing = this.byId.get(id);
    if (existing) return existing;

    const g = new PIXI.Graphics();
    (g as any).__bubbleId = id;

    this.byId.set(id, g);
    this.container.addChild(g);
    return g;
  }

  private removeGraphic(id: string) {
    const g = this.byId.get(id);
    if (!g) return;
    g.destroy();
    this.byId.delete(id);
    this.drawCache.delete(id);
  }

  private redrawCircle(g: PIXI.Graphics, id: string, draw: CachedDraw) {
    g.clear();

    if ((draw.bw ?? 0) > 0) {
      g.lineStyle(draw.bw!, draw.bc!, 1);
    }

    g.beginFill(draw.fill ?? 0x000000, draw.fillAlpha ?? 1);
    g.drawCircle(0, 0, draw.r);
    g.endFill();

    this.drawCache.set(id, draw);
  }

  private redrawPie(args: {
    g: PIXI.Graphics;
    id: string;
    cfg: BubblesStyleConfig;
    radius: number;
    segs: Array<{ key: BubblePieKey; value: number; color: number }>;
    alpha: number;
    bw: number;
    bc: number;
    hash: string;
    innerRatio: number;
  }) {
    const { g, id, cfg, radius, segs, alpha, bw, bc, hash, innerRatio } = args;

    g.clear();

    const total = segs.reduce((acc, s) => acc + s.value, 0);

    // fallback: círculo sólido
    if (!Number.isFinite(total) || total <= 0) {
      const fill = hexToNumber(cfg.color ?? "#000000");
      this.redrawCircle(g, id, {
        r: radius,
        fill,
        fillAlpha: alpha,
        bw,
        bc,
        mode: "circle",
      });
      return;
    }

    // arranque arriba
    let a0 = -Math.PI / 2;

    for (const s of segs) {
      const frac = s.value / total;
      if (!Number.isFinite(frac) || frac <= 0) continue;

      const a1 = a0 + frac * Math.PI * 2;

      const x0 = Math.cos(a0) * radius;
      const y0 = Math.sin(a0) * radius;

      g.beginFill(s.color, alpha);

      // wedge robusto
      g.moveTo(0, 0);
      g.lineTo(x0, y0);
      g.arc(0, 0, radius, a0, a1);
      g.lineTo(0, 0);

      g.endFill();

      a0 = a1;
    }

    // donut opcional (si tu PIXI soporta ERASE)
    const inner = clamp(innerRatio, 0, 0.9);
    if (inner > 0) {
      const innerR = radius * inner;

      const prevBlend = (g as any).blendMode;
      (g as any).blendMode = (PIXI as any).BLEND_MODES?.ERASE ?? prevBlend;

      g.beginFill(0xffffff, 1);
      g.drawCircle(0, 0, innerR);
      g.endFill();

      (g as any).blendMode = prevBlend;
    }

    // borde al final
    if (bw > 0) {
      g.lineStyle(bw, bc, 1);
      g.drawCircle(0, 0, radius);
    }

    this.drawCache.set(id, {
      r: radius,
      bw,
      bc,
      mode: "pie",
      pieHash: hash,
    });
  }

  private syncGraphics() {
    const cfg = this.cfg;
    if (!cfg || !cfg.enabled) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    if (!this.data || this.data.length === 0) {
      for (const id of Array.from(this.byId.keys())) this.removeGraphic(id);
      this.container.removeChildren();
      return;
    }

    // domain para radius desde p.value
    this.resolvedDomain = this.resolveDomain(cfg);

    const bw = Math.max(0, cfg.borderWidth ?? 0);
    const alpha = clamp(cfg.opacity ?? 1, 0, 1);
    const fill = hexToNumber(cfg.color ?? "#000000");
    const bc = hexToNumber(cfg.borderColor ?? "#000000");

    const renderMode: BubbleRenderMode = (cfg.renderMode ??
      "circle") as BubbleRenderMode;

    const pieMinTotal = Number.isFinite(cfg.pieMinTotal as any)
      ? (cfg.pieMinTotal as number)
      : 0;
    const innerRatio = clamp(cfg.pieInnerRadiusRatio ?? 0, 0, 0.9);

    const currentIds = new Set<string>();

    for (const p of this.data) {
      const isNullish = p.value == null || !Number.isFinite(p.value as any);
      if (cfg.hideNull && isNullish) continue;

      const id = p.id;
      currentIds.add(id);

      const v = isNullish ? 0 : (p.value as number);
      const r = valueToRadius(v, cfg, this.resolvedDomain);

      if (!Number.isFinite(r) || r <= 0) {
        const g0 = this.byId.get(id);
        if (g0) g0.renderable = false;
        continue;
      }

      const g = this.ensureGraphic(id);
      g.visible = true;
      g.renderable = true;

      // ✅ PIE MODE
      if (renderMode === "pie" && p.pie) {
        const segs = buildPieSegments(p, cfg);
        const total = segs.reduce((acc, s) => acc + s.value, 0);

        // fallback circle si no hay pie usable
        if (
          !Number.isFinite(total) ||
          total <= pieMinTotal ||
          segs.length === 0
        ) {
          const nextDraw: CachedDraw = {
            r,
            fill,
            fillAlpha: alpha,
            bw,
            bc,
            mode: "circle",
            pieHash: undefined,
          };

          const prev = this.drawCache.get(id);
          const needs =
            !prev ||
            prev.mode !== "circle" ||
            prev.r !== nextDraw.r ||
            prev.fill !== nextDraw.fill ||
            prev.fillAlpha !== nextDraw.fillAlpha ||
            prev.bw !== nextDraw.bw ||
            prev.bc !== nextDraw.bc;

          if (needs) this.redrawCircle(g, id, nextDraw);
          continue;
        }

        const hash = pieHashForCache({
          segs,
          alpha,
          bw,
          bc,
          inner: innerRatio,
        });

        const prev = this.drawCache.get(id);
        const needs =
          !prev ||
          prev.mode !== "pie" ||
          prev.r !== r ||
          prev.bw !== bw ||
          prev.bc !== bc ||
          prev.pieHash !== hash;

        if (needs) {
          this.redrawPie({
            g,
            id,
            cfg,
            radius: r,
            segs,
            alpha,
            bw,
            bc,
            hash,
            innerRatio,
          });
        }

        continue;
      }

      // ✅ CIRCLE MODE
      const nextDraw: CachedDraw = {
        r,
        fill,
        fillAlpha: alpha,
        bw,
        bc,
        mode: "circle",
        pieHash: undefined,
      };

      const prev = this.drawCache.get(id);
      const needsRedraw =
        !prev ||
        prev.mode !== "circle" ||
        prev.r !== nextDraw.r ||
        prev.fill !== nextDraw.fill ||
        prev.fillAlpha !== nextDraw.fillAlpha ||
        prev.bw !== nextDraw.bw ||
        prev.bc !== nextDraw.bc;

      if (needsRedraw) this.redrawCircle(g, id, nextDraw);
    }

    // borrar ids viejos
    for (const id of Array.from(this.byId.keys())) {
      if (!currentIds.has(id)) this.removeGraphic(id);
    }
  }

  render(camera: Camera2D) {
    for (const p of this.data) {
      const g = this.byId.get(p.id);
      if (!g) continue;

      const s = camera.worldToScreen({ x: p.x, y: p.y }, this.vp);
      g.position.set(s.x, s.y);

      const inside =
        s.x >= -200 &&
        s.x <= this.vp.width + 200 &&
        s.y >= -200 &&
        s.y <= this.vp.height + 200;

      g.renderable = inside;
    }
  }

  destroy() {
    for (const g of this.byId.values()) g.destroy();
    this.byId.clear();
    this.drawCache.clear();
    this.container.destroy({ children: true });
  }
}
