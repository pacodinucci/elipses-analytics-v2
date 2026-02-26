// src/viewer/engine/viewer-engine.ts
import * as PIXI from "pixi.js";
import type { ViewportRect } from "../types";
import { Camera2D } from "./camera/camera-2d";

import {
  EllipsesPolygonsLayer,
  type ElipseRow,
  type EllipsesPolygonStyle,
} from "./layers/elipses/ellipses-polygons-layer";

import { resizeOverlayCanvas } from "./overlay/overlay-canvas";
import { drawGrid, type GridConfig } from "./overlay/grid";

import type { HeatmapStyle } from "../../store/heatmap-style";
import {
  HeatmapLayer,
  type HeatmapPayload,
} from "./layers/heatmap/heatmap-layer";

import {
  PointsLayer,
  type WellPoint,
  type PozosStyleConfig,
} from "./layers/points/points-layer";

// ✅ NUEVO: bubbles layer (genérico)
import {
  BubblesLayer,
  type BubblePoint,
  type BubblesStyleConfig,
} from "./layers/bubbles/bubbles-layer";

// ✅ tipos de normalización (ranges)
import type {
  ElipsesNormalizationRanges,
  ElipsesNormalizationScope,
  ElipsesNormalizationContext,
} from "../../store/elipses-style";

export type ViewerEngineOptions = {
  container: HTMLDivElement;
  backgroundAlpha?: number;
};

export type EllipsesNormalizationInput = {
  ranges: ElipsesNormalizationRanges;
  scope?: ElipsesNormalizationScope | null;
  context?: ElipsesNormalizationContext | null;
};

export type AxisChannelNormalizationInput = {
  color?: EllipsesNormalizationInput | null;
  width?: EllipsesNormalizationInput | null;
  alpha?: EllipsesNormalizationInput | null;
};

export type StrokeChannelNormalizationInput = {
  color?: EllipsesNormalizationInput | null;
  width?: EllipsesNormalizationInput | null;
  alpha?: EllipsesNormalizationInput | null;
};

export type FillChannelNormalizationInput = {
  color?: EllipsesNormalizationInput | null;
  alpha?: EllipsesNormalizationInput | null;
};

export type EllipsesContextInput = {
  selectedDate?: string | null;
  selectedVariable?: string | null;
  showHistorical?: boolean;
};

export class ViewerEngine {
  private app: PIXI.Application;
  private camera: Camera2D;
  private vp: ViewportRect;

  private heatmapLayer: HeatmapLayer;
  private ellipsesLayer: EllipsesPolygonsLayer;
  private bubblesLayer: BubblesLayer; // ✅ NUEVO
  private pointsLayer: PointsLayer;

  private view: HTMLCanvasElement;

  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  private grid: GridConfig = {
    enabled: true,
    spacingX: 2000,
    spacingY: 2000,
    color: "rgba(0,0,0,0.12)",
    width: 1,
  };

  private axisX: number[] = [];
  private axisY: number[] = [];

  private lastEllipsesContext: EllipsesContextInput = {
    selectedDate: null,
    selectedVariable: null,
    showHistorical: false,
  };

  constructor(opts: ViewerEngineOptions) {
    const { container, backgroundAlpha = 0 } = opts;

    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    this.vp = {
      width: container.clientWidth || 1,
      height: container.clientHeight || 1,
    };

    this.app = new PIXI.Application({
      antialias: true,
      backgroundAlpha,
      backgroundColor: 0xffffff,
      width: this.vp.width,
      height: this.vp.height,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    this.view = this.app.view as unknown as HTMLCanvasElement;
    container.appendChild(this.view);

    this.view.style.position = "absolute";
    this.view.style.left = "0";
    this.view.style.top = "0";
    this.view.style.zIndex = "1";
    this.view.style.width = `${this.vp.width}px`;
    this.view.style.height = `${this.vp.height}px`;

    this.app.renderer.resize(this.vp.width, this.vp.height);

    this.camera = new Camera2D({ x: 0, y: 0 }, 1);

    this.app.stage.sortableChildren = true;

    this.heatmapLayer = new HeatmapLayer(this.app);
    this.heatmapLayer.setViewport(this.vp);

    this.ellipsesLayer = new EllipsesPolygonsLayer(this.app);
    this.ellipsesLayer.setViewport(this.vp);

    // ✅ NUEVO: bubbles entre elipses y pozos
    this.bubblesLayer = new BubblesLayer(this.app);
    this.bubblesLayer.setViewport(this.vp);

    this.pointsLayer = new PointsLayer(this.app);
    this.pointsLayer.setViewport(this.vp);

    this.app.stage.sortChildren();

    this.app.ticker.add(() => {
      this.heatmapLayer.render(this.camera);
      this.ellipsesLayer.render(this.camera);
      this.bubblesLayer.render(this.camera); // ✅
      this.pointsLayer.render(this.camera);
    });
  }

  destroy() {
    this.heatmapLayer.destroy();
    this.ellipsesLayer.destroy();
    this.bubblesLayer.destroy(); // ✅
    this.pointsLayer.destroy();

    if (this.overlayCanvas?.parentElement) {
      this.overlayCanvas.parentElement.removeChild(this.overlayCanvas);
    }

    this.overlayCanvas = null;
    this.overlayCtx = null;

    this.app.destroy(true);
  }

  resize(width: number, height: number) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));

    if (this.vp.width === w && this.vp.height === h) return;

    this.vp = { width: w, height: h };

    this.app.renderer.resize(w, h);

    this.view.style.width = `${w}px`;
    this.view.style.height = `${h}px`;

    this.heatmapLayer.setViewport(this.vp);
    this.ellipsesLayer.setViewport(this.vp);
    this.bubblesLayer.setViewport(this.vp); // ✅
    this.pointsLayer.setViewport(this.vp);

    if (this.overlayCanvas) {
      this.overlayCtx = resizeOverlayCanvas(this.overlayCanvas, this.vp);
      if (this.overlayCtx) {
        drawGrid(this.overlayCtx, this.camera, this.vp, this.grid, {
          x: { ticks: this.axisX },
          y: { ticks: this.axisY },
        });
      }
    }

    this.heatmapLayer.render(this.camera);
    this.ellipsesLayer.render(this.camera);
    this.bubblesLayer.render(this.camera); // ✅
    this.pointsLayer.render(this.camera);
    this.app.renderer.render(this.app.stage);
  }

  attachOverlay(canvas: HTMLCanvasElement) {
    this.overlayCanvas = canvas;

    if (!canvas.parentElement) {
      this.view.parentElement?.appendChild(canvas);
    }

    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.right = "0";
    canvas.style.bottom = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "0";

    this.overlayCtx = resizeOverlayCanvas(canvas, this.vp);

    drawGrid(this.overlayCtx, this.camera, this.vp, this.grid, {
      x: { ticks: this.axisX },
      y: { ticks: this.axisY },
    });
  }

  setGrid(cfg: Partial<GridConfig>) {
    this.grid = { ...this.grid, ...cfg };

    if (this.overlayCtx) {
      drawGrid(this.overlayCtx, this.camera, this.vp, this.grid, {
        x: { ticks: this.axisX },
        y: { ticks: this.axisY },
      });
    }
  }

  setEllipses(data: ElipseRow[]) {
    this.ellipsesLayer.setData(data);
  }

  setEllipsesContext(ctx: EllipsesContextInput) {
    this.lastEllipsesContext = {
      ...this.lastEllipsesContext,
      ...ctx,
    };

    console.log("[ViewerEngine] Ellipses context:", this.lastEllipsesContext);
    this.ellipsesLayer.setContext(this.lastEllipsesContext as any);
  }

  setEllipsesHistorical(enabled: boolean) {
    this.setEllipsesContext({ showHistorical: enabled });
  }

  setEllipsesNormalization(payload: EllipsesNormalizationInput) {
    this.ellipsesLayer.setNormalization(payload);
  }

  // ✅ mostrar/ocultar elipses
  setShowElipses(v: boolean) {
    this.ellipsesLayer.setVisible(v);
  }

  // ✅ estilos elipses
  setElipsesStyle(style: Partial<EllipsesPolygonStyle>) {
    this.ellipsesLayer.setStyle(style);
  }

  // ✅ estilos pozos
  setPozosStyleConfig(cfg: PozosStyleConfig) {
    this.pointsLayer.setConfig(cfg);
  }

  // ✅ pozos
  setWells(wells: WellPoint[]) {
    this.pointsLayer.setData(wells);
  }

  // ─────────────────────────────
  // ✅ BUBBLES (genérico)
  // ─────────────────────────────
  setBubbles(bubbles: BubblePoint[]) {
    this.bubblesLayer.setData(bubbles ?? []);
  }

  setBubblesStyleConfig(cfg: BubblesStyleConfig) {
    this.bubblesLayer.setConfig(cfg);
  }

  setShowBubbles(v: boolean) {
    this.bubblesLayer.setVisible(v);
  }

  setHeatmap(payload: {
    grid: (number | null)[][];
    xEdges: number[];
    yEdges: number[];
    style: HeatmapStyle;
    dataMin: number;
    dataMax: number;
  }) {
    const p: HeatmapPayload = payload;
    this.heatmapLayer.setData(p);

    this.axisX = payload.xEdges;
    this.axisY = payload.yEdges;

    const xMin = Math.min(...payload.xEdges);
    const xMax = Math.max(...payload.xEdges);
    const yMin = Math.min(...payload.yEdges);
    const yMax = Math.max(...payload.yEdges);

    const worldW = xMax - xMin || 1;
    const worldH = yMax - yMin || 1;

    const padPx = 40;

    const scaleX = (this.vp.width - padPx * 2) / worldW;
    const scaleY = (this.vp.height - padPx * 2) / worldH;
    const nextScale = Math.max(0.00001, Math.min(scaleX, scaleY));

    const nextCenter = { x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 };

    this.camera.setView(nextCenter, nextScale);

    if (this.overlayCtx) {
      drawGrid(this.overlayCtx, this.camera, this.vp, this.grid, {
        x: { ticks: this.axisX },
        y: { ticks: this.axisY },
      });
    }
  }

  clearHeatmap() {
    this.heatmapLayer.clear();

    this.axisX = [];
    this.axisY = [];

    if (this.overlayCtx) {
      drawGrid(this.overlayCtx, this.camera, this.vp, this.grid, {
        x: { ticks: this.axisX },
        y: { ticks: this.axisY },
      });
    }
  }

  panBy(dxPx: number, dyPx: number) {
    this.camera.panByScreenDelta(dxPx, dyPx);

    if (this.overlayCtx) {
      drawGrid(this.overlayCtx, this.camera, this.vp, this.grid, {
        x: { ticks: this.axisX },
        y: { ticks: this.axisY },
      });
    }
  }

  zoomAt(factor: number, xPx: number, yPx: number) {
    this.camera.zoomAtScreenPoint(factor, { x: xPx, y: yPx }, this.vp);

    if (this.overlayCtx) {
      drawGrid(this.overlayCtx, this.camera, this.vp, this.grid, {
        x: { ticks: this.axisX },
        y: { ticks: this.axisY },
      });
    }
  }

  setCameraInteracting(v: boolean) {
    this.camera.setInteracting(v);
  }

  // (resto de setters de normalización axis/contour/fill quedan igual a tu archivo original)
  // 👆 No los repito acá para no romperte el pegado: dejalos tal cual estaban en tu viewer-engine.ts.
}
