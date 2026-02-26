import type { ViewportRect } from "../../types";

export function resizeOverlayCanvas(
  canvas: HTMLCanvasElement,
  vp: ViewportRect,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.floor(vp.width * dpr));
  canvas.height = Math.max(1, Math.floor(vp.height * dpr));

  canvas.style.width = `${vp.width}px`;
  canvas.style.height = `${vp.height}px`;

  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return ctx;
}
