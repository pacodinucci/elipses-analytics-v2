// src/electron/modules/maps/interfaces/legacyAdapter.ts
import type { Mapa } from "../../../backend/models.js";

/**
 * Legacy payload: se mantiene para compatibilidad con el visualizador viejo.
 * Con el modelo actual, la relación de Mapa se resuelve por variableMapaId.
 */
export interface LegacyVisualizerMapPayload {
  capaId: string;
  variableMapaId?: string;
}

export interface LegacyVisualizerMapResponse {
  capaId: string;
  variableMapaId: string;
  xedges: number[];
  yedges: number[];

  // ✅ v2: el grid puede contener nulls (celdas sin dato)
  grid: (number | null)[][];
}

export function toLegacyVisualizerMapResponse(
  map: Mapa,
): LegacyVisualizerMapResponse {
  return {
    capaId: map.capaId,
    variableMapaId: map.variableMapaId,
    xedges: map.xedges,
    yedges: map.yedges,
    grid: map.grid,
  };
}
