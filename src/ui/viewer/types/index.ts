// src/ui/viewer/tpyes/index.ts

export type ViewportRect = {
  width: number;
  height: number;
};

export type EllipseInstance = {
  id: string;
  cx: number;
  cy: number;
  a: number;
  b: number;
  rot: number; // rad
  fill: [number, number, number, number]; // 0..1
  stroke?: [number, number, number, number]; // (no lo usamos en MVP shader)
  strokeWidth?: number;
  visible?: boolean;
};
