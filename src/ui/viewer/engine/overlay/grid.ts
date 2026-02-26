import type { ViewportRect } from "../../types";
import type { Camera2D } from "../camera/camera-2d";

export type GridConfig = {
  enabled: boolean;
  spacingX: number; // dtick
  spacingY: number;
  color: string;
  width: number;
};

export type AxisSide = {
  ticks: number[]; // xEdges / yEdges (solo para anclar el origen)
  formatter?: (v: number) => string;
};

export type AxisConfig = {
  x?: AxisSide;
  y?: AxisSide;
};

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera2D,
  vp: ViewportRect,
  grid: GridConfig,
  axes?: AxisConfig,
) {
  if (!grid.enabled) return;

  ctx.clearRect(0, 0, vp.width, vp.height);

  // Bounds visibles en WORLD
  const wBL = camera.screenToWorld({ x: 0, y: vp.height }, vp);
  const wTR = camera.screenToWorld({ x: vp.width, y: 0 }, vp);

  const xMin = Math.min(wBL.x, wTR.x);
  const xMax = Math.max(wBL.x, wTR.x);
  const yMin = Math.min(wBL.y, wTR.y);
  const yMax = Math.max(wBL.y, wTR.y);

  // ✅ Si tenemos edges del mapa: los usamos SOLO para anclar origen (continuidad tipo Plotly)
  const xOrigin = axes?.x?.ticks?.length ? minOf(axes.x.ticks) : null;
  const yOrigin = axes?.y?.ticks?.length ? minOf(axes.y.ticks) : null;

  const xTicks =
    xOrigin != null
      ? ticksFromOrigin(xOrigin, xMin, xMax, grid.spacingX)
      : ticksFromDtick(xMin, xMax, grid.spacingX);

  const yTicks =
    yOrigin != null
      ? ticksFromOrigin(yOrigin, yMin, yMax, grid.spacingY)
      : ticksFromDtick(yMin, yMax, grid.spacingY);

  // --------------------
  // Grid lines
  // --------------------
  ctx.save();
  ctx.lineWidth = grid.width;
  ctx.strokeStyle = grid.color;

  // Vertical
  for (const x of xTicks) {
    const sx = camera.worldToScreen({ x, y: 0 }, vp).x;
    const px = Math.round(sx) + 0.5;

    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, vp.height);
    ctx.stroke();
  }

  // Horizontal
  for (const y of yTicks) {
    const sy = camera.worldToScreen({ x: 0, y }, vp).y;
    const py = Math.round(sy) + 0.5;

    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(vp.width, py);
    ctx.stroke();
  }

  ctx.restore();

  // --------------------
  // Labels (1:1 con líneas)
  // --------------------
  if (axes?.x) drawXAxisLabels(ctx, camera, vp, xTicks, axes.x.formatter);
  if (axes?.y) drawYAxisLabels(ctx, camera, vp, yTicks, axes.y.formatter);
}

function drawXAxisLabels(
  ctx: CanvasRenderingContext2D,
  camera: Camera2D,
  vp: ViewportRect,
  ticks: number[],
  formatter?: (v: number) => string,
) {
  const fmt = formatter ?? formatSI;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const y = vp.height - 18;

  for (const xVal of ticks) {
    const sx = camera.worldToScreen({ x: xVal, y: 0 }, vp).x;
    const px = Math.round(sx) + 0.5;
    if (px < 0 || px > vp.width) continue;
    ctx.fillText(fmt(xVal), px, y);
  }

  ctx.restore();
}

function drawYAxisLabels(
  ctx: CanvasRenderingContext2D,
  camera: Camera2D,
  vp: ViewportRect,
  ticks: number[],
  formatter?: (v: number) => string,
) {
  const fmt = formatter ?? formatSI;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.font = "12px system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const x = 52;

  for (const yVal of ticks) {
    const sy = camera.worldToScreen({ x: 0, y: yVal }, vp).y;
    const py = Math.round(sy) + 0.5;
    if (py < 0 || py > vp.height) continue;
    ctx.fillText(fmt(yVal), x, py);
  }

  ctx.restore();
}

/**
 * ✅ Ticks infinitos (para el viewport) anclados a un origen del mapa:
 * x = origin + k*step
 */
function ticksFromOrigin(
  origin: number,
  minVisible: number,
  maxVisible: number,
  step: number,
): number[] {
  if (!step) return [];

  // primer k tal que origin + k*step >= minVisible
  const k0 = Math.ceil((minVisible - origin) / step);
  const start = origin + k0 * step;

  const out: number[] = [];
  for (let v = start; v <= maxVisible; v += step) out.push(v);
  return out;
}

/**
 * Fallback (si no tenemos origen del mapa)
 */
function ticksFromDtick(
  minVisible: number,
  maxVisible: number,
  step: number,
): number[] {
  if (!step) return [];
  const start = ceilToStep(minVisible, step);
  const out: number[] = [];
  for (let v = start; v <= maxVisible; v += step) out.push(v);
  return out;
}

function ceilToStep(v: number, step: number) {
  return Math.ceil(v / step) * step;
}

function minOf(arr: number[]) {
  let m = Number.POSITIVE_INFINITY;
  for (const v of arr) if (Number.isFinite(v) && v < m) m = v;
  return m === Number.POSITIVE_INFINITY ? 0 : m;
}

// Formato tipo Plotly: 682k / 9.436M
function formatSI(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return (v / 1e6).toFixed(3) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + "k";
  return v.toFixed(0);
}
