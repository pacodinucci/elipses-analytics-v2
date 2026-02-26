// scr/ui/viewer/engine/camera/camera-2d.ts

import type { ViewportRect } from "../../types";

export type Vec2 = { x: number; y: number };

export type CameraState = {
  center: Vec2;
  scale: number;
  isInteracting: boolean;
};

export type Mat2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
};

export class Camera2D {
  state: CameraState;

  constructor(center: Vec2, scale: number) {
    this.state = { center, scale, isInteracting: false };
  }

  setInteracting(v: boolean) {
    this.state.isInteracting = v;
  }

  panByScreenDelta(dxPx: number, dyPx: number) {
    const { center, scale } = this.state;
    this.state.center = {
      x: center.x - dxPx / scale,
      y: center.y + dyPx / scale,
    };
  }

  screenToWorld(p: Vec2, vp: ViewportRect): Vec2 {
    const { center, scale } = this.state;
    return {
      x: (p.x - vp.width * 0.5) / scale + center.x,
      y: center.y - (p.y - vp.height * 0.5) / scale,
    };
  }

  worldToScreen(p: Vec2, vp: ViewportRect): Vec2 {
    const { center, scale } = this.state;

    const sx = (p.x - center.x) * scale + vp.width * 0.5;
    const sy = (center.y - p.y) * scale + vp.height * 0.5;

    return { x: sx, y: sy };
  }

  zoomAtScreenPoint(factor: number, screenPt: Vec2, vp: ViewportRect) {
    const before = this.screenToWorld(screenPt, vp);

    this.state.scale = clamp(this.state.scale * factor, 0.00001, 1e9);

    const after = this.screenToWorld(screenPt, vp);
    const { center } = this.state;

    this.state.center = {
      x: center.x + (before.x - after.x),
      y: center.y + (before.y - after.y),
    };
  }

  setView(center: { x: number; y: number }, scale: number) {
    this.state.center = center;
    this.state.scale = scale;
  }

  getWorldToScreenMatrix(vp: ViewportRect): Mat2D {
    const { center, scale } = this.state;

    // sx = (x - cx) * s + vw/2
    // sy = (cy - y) * s + vh/2  => sy = (-s)*y + (vh/2 + cy*s)
    return {
      a: scale,
      b: 0,
      c: 0,
      d: -scale,
      tx: vp.width * 0.5 - center.x * scale,
      ty: vp.height * 0.5 + center.y * scale,
    };
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
