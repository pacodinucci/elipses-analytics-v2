import * as PIXI from "pixi.js";
import type { ViewportRect } from "../../../types";
import type { Camera2D } from "../../camera/camera-2d";
import type { HeatmapStyle } from "../../../../store/heatmap-style";
import { buildStops, opacityColor, sampleStops } from "./colors";

export type HeatmapPayload = {
  grid: (number | null)[][];
  xEdges: number[];
  yEdges: number[];
  style: HeatmapStyle;
  dataMin: number;
  dataMax: number;
};

export class HeatmapLayer {
  private app: PIXI.Application;
  private vp: ViewportRect = { width: 1, height: 1 };

  private sprite: PIXI.Sprite;
  private texture: PIXI.Texture | null = null;

  private hasData = false;

  // bounds en world
  private xMin = 0;
  private xMax = 1;
  private yMin = 0;
  private yMax = 1;

  constructor(app: PIXI.Application) {
    this.app = app;

    // ✅ Asegurar orden por zIndex (para que elipses/pozos queden arriba)
    this.app.stage.sortableChildren = true;

    this.sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.sprite.visible = false;
    this.sprite.alpha = 1;
    this.sprite.anchor.set(0, 0);

    // ✅ Heatmap debe quedar abajo de elipses y pozos
    this.sprite.zIndex = 10;

    // ✅ Evitar recortes por culling/bounds en Pixi
    // (Pixi v7 no tipa cullable en Sprite en algunos builds)
    (this.sprite as unknown as { cullable?: boolean }).cullable = false;

    // No dependemos del índice: usamos zIndex
    this.app.stage.addChild(this.sprite);
    this.app.stage.sortChildren();
  }

  setViewport(vp: ViewportRect) {
    this.vp = vp;
  }

  clear() {
    this.hasData = false;
    this.sprite.visible = false;

    if (this.texture) {
      this.texture.destroy(true);
      this.texture = null;
    }

    this.sprite.texture = PIXI.Texture.WHITE;
  }

  setData(payload: HeatmapPayload) {
    const { grid, xEdges, yEdges, style, dataMin, dataMax } = payload;

    const ny = grid.length;
    const nx = grid[0]?.length ?? 0;

    if (ny === 0 || nx === 0) {
      this.clear();
      return;
    }

    this.xMin = Math.min(...xEdges);
    this.xMax = Math.max(...xEdges);
    this.yMin = Math.min(...yEdges);
    this.yMax = Math.max(...yEdges);

    const span = dataMax - dataMin || 1;

    const stops = buildStops(dataMin, dataMax, style);
    const opRgb = opacityColor(style);

    const pixels = new Uint8Array(nx * ny * 4);

    // Plotly: row 0 = y mínimo (abajo). Imagen: row 0 = arriba => flip vertical
    for (let row = 0; row < ny; row++) {
      const outRow = ny - 1 - row;
      for (let col = 0; col < nx; col++) {
        const v = grid[row][col];
        const i = (outRow * nx + col) * 4;

        if (v == null || Number.isNaN(v)) {
          pixels[i + 0] = 0;
          pixels[i + 1] = 0;
          pixels[i + 2] = 0;
          pixels[i + 3] = 0;
          continue;
        }

        const t = Math.max(0, Math.min(1, (v - dataMin) / span));

        if (style.fillMode === "opacity") {
          pixels[i + 0] = opRgb.r;
          pixels[i + 1] = opRgb.g;
          pixels[i + 2] = opRgb.b;
          pixels[i + 3] = Math.round(255 * t);
        } else {
          const rgb = sampleStops(stops, t);
          pixels[i + 0] = rgb.r;
          pixels[i + 1] = rgb.g;
          pixels[i + 2] = rgb.b;
          pixels[i + 3] = 255;
        }
      }
    }

    if (this.texture) {
      this.texture.destroy(true);
      this.texture = null;
    }

    this.texture = PIXI.Texture.fromBuffer(pixels, nx, ny);
    this.sprite.texture = this.texture;

    // ✅ Textura estable al pan/zoom
    this.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.CLAMP;
    this.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
    this.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

    this.hasData = true;
    this.sprite.visible = true;
  }

  render(camera: Camera2D) {
    if (!this.hasData) return;

    const { center, scale } = camera.state;

    const left = (this.xMin - center.x) * scale + this.vp.width * 0.5;
    const right = (this.xMax - center.x) * scale + this.vp.width * 0.5;

    const top = (center.y - this.yMax) * scale + this.vp.height * 0.5;
    const bottom = (center.y - this.yMin) * scale + this.vp.height * 0.5;

    const w = right - left;
    const h = bottom - top;

    // ✅ Overdraw más generoso para evitar cortes visuales
    const PAD = 8;

    this.sprite.position.set(left - PAD, top - PAD);
    this.sprite.width = w + PAD * 2;
    this.sprite.height = h + PAD * 2;
  }

  destroy() {
    this.clear();
    this.sprite.destroy(true);
  }
}
