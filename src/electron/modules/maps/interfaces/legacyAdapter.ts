import type { Mapa } from "../../../backend/models.js";

export interface LegacyVisualizerMapPayload {
  capaId: string;
  variableMapaId?: string;
}

export interface LegacyVisualizerMapResponse {
  capaId: string;
  variableMapaId: string;
  xedges: number[];
  yedges: number[];
  grid: number[][];
}

export function toLegacyVisualizerMapResponse(map: Mapa): LegacyVisualizerMapResponse {
  return {
    capaId: map.capaId,
    variableMapaId: map.variableMapaId,
    xedges: map.xedges,
    yedges: map.yedges,
    grid: map.grid,
  };
}
