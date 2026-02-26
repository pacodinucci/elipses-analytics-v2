// scr/ui/viewer/engine/layers/points/points-layer.ts

import * as PIXI from "pixi.js";
import type { ViewportRect } from "../../../types";
import type { Camera2D } from "../../camera/camera-2d";

// Reusamos tus estados de pozo
export type PozoEstado = -1 | 0 | 1 | 2;

export type WellPoint = {
  id: string;
  nombre: string;
  x: number;
  y: number;
  estado: PozoEstado;
};

// Este tipo lo tomamos del store (importalo donde lo uses)
export type PozosStyleConfig = {
  hideNonexistent: boolean;
  hideClosed: boolean;
  mode: "uniform" | "byState";
  base: PozoStyle;
  byState: Partial<Record<PozoEstado, Partial<PozoStyle>>>;
};

// Esto debe coincidir con tu store pozos-style (si hay algún campo distinto, lo ajustamos)
export type PozoStyle = {
  enabled: boolean;
  size: number; // px
  symbol: string; // "square" | "circle" | ...
  color: string; // "#RRGGBB"
  opacity: number; // 0..1
  borderWidth: number; // px
  borderColor: string; // "#RRGGBB"
};

function hexToNumber(hex: string): number {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return 0x000000;
  return parseInt(h, 16);
}

function mergeStyle(base: PozoStyle, override?: Partial<PozoStyle>): PozoStyle {
  return { ...base, ...(override ?? {}) };
}

function drawSymbol(g: PIXI.Graphics, symbol: string, size: number) {
  const half = size / 2;

  switch (symbol) {
    case "circle":
      g.drawCircle(0, 0, half);
      return;
    case "diamond":
      g.moveTo(0, -half);
      g.lineTo(half, 0);
      g.lineTo(0, half);
      g.lineTo(-half, 0);
      g.closePath();
      return;
    case "triangle-up":
      g.moveTo(0, -half);
      g.lineTo(half, half);
      g.lineTo(-half, half);
      g.closePath();
      return;
    case "triangle-down":
      g.moveTo(-half, -half);
      g.lineTo(half, -half);
      g.lineTo(0, half);
      g.closePath();
      return;
    case "square":
    default:
      g.drawRect(-half, -half, size, size);
      return;
  }
}

export class PointsLayer {
  private app: PIXI.Application;
  private vp: ViewportRect = { width: 1, height: 1 };

  // Screen-space container (NO se escala con la cámara)
  private container: PIXI.Container;

  private wells: WellPoint[] = [];
  private byId = new Map<string, PIXI.Graphics>();

  // Config actual (lo seteamos desde el ViewerEngine)
  private cfg: PozosStyleConfig | null = null;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.app.stage.sortableChildren = true;

    this.container = new PIXI.Container();
    this.container.zIndex = 30;
    this.app.stage.addChild(this.container);
  }

  setViewport(vp: ViewportRect) {
    this.vp = vp;
  }

  setConfig(cfg: PozosStyleConfig) {
    this.cfg = cfg;
    this.rebuildGraphics(); // redibuja con el nuevo estilo
  }

  setData(wells: WellPoint[]) {
    this.wells = wells;
    this.rebuildGraphics(); // redibuja cuando cambia la data
  }

  clear() {
    this.setData([]);
  }

  private rebuildGraphics() {
    // Si todavía no hay config o data, limpiamos y listo.
    const cfg = this.cfg;

    // destruir todo
    for (const g of this.byId.values()) g.destroy();
    this.byId.clear();
    this.container.removeChildren();

    if (!cfg) return;
    if (!cfg.base?.enabled) return;
    if (!this.wells || this.wells.length === 0) return;

    // filtrado igual a Plotly
    const filtered = this.wells.filter((p) => {
      if (cfg.hideNonexistent && p.estado === -1) return false;
      if (cfg.hideClosed && p.estado === 0) return false;
      return true;
    });

    if (filtered.length === 0) return;

    // crear graphics por pozo (610 pozos es ok)
    for (const p of filtered) {
      let st: PozoStyle;

      if (cfg.mode === "uniform") {
        st = cfg.base;
      } else {
        st = mergeStyle(cfg.base, cfg.byState?.[p.estado]);
      }

      if (!st.enabled) continue;

      const g = new PIXI.Graphics();

      // borde
      const bw = Math.max(0, st.borderWidth ?? 0);
      if (bw > 0) {
        g.lineStyle(bw, hexToNumber(st.borderColor ?? "#000000"), 1);
      }

      // fill
      g.beginFill(
        hexToNumber(st.color ?? "#000000"),
        Math.max(0, Math.min(1, st.opacity ?? 1)),
      );

      // símbolo + tamaño
      const size = Math.max(1, st.size ?? 6);
      drawSymbol(g, st.symbol ?? "square", size);

      g.endFill();

      // metadata (para hover/picking futuro)
      (g as any).__wellId = p.id;
      (g as any).__wellName = p.nombre;
      (g as any).__wellEstado = p.estado;

      this.byId.set(p.id, g);
      this.container.addChild(g);
    }
  }

  render(camera: Camera2D) {
    // Reposicionar cada pozo en pantalla (igual a Plotly markers en px)
    for (const p of this.wells) {
      const g = this.byId.get(p.id);
      if (!g) continue;

      const s = camera.worldToScreen({ x: p.x, y: p.y }, this.vp);
      g.position.set(s.x, s.y);

      // opcional: micro-culling para no dibujar fuera
      g.visible =
        s.x >= -50 &&
        s.x <= this.vp.width + 50 &&
        s.y >= -50 &&
        s.y <= this.vp.height + 50;
    }
  }

  destroy() {
    for (const g of this.byId.values()) g.destroy();
    this.byId.clear();
    this.container.destroy({ children: true });
  }
}
