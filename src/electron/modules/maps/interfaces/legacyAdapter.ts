import type { Mapa } from "../../../backend/models.js";

/**
 * Legacy payload: se mantiene para compatibilidad con el visualizador viejo.
 * Con el modelo nuevo (A: 1 mapa por capa) el filtro por variableMapaId ya no aplica.
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
  grid: number[][];
}

export function toLegacyVisualizerMapResponse(
  map: Mapa,
): LegacyVisualizerMapResponse {
  return {
    capaId: map.capaId,
    // ✅ en el modelo nuevo, esto representa el grupo de variables del mapa
    variableMapaId: map.grupoVariableId,
    xedges: map.xedges,
    yedges: map.yedges,
    grid: map.grid,
  };
}
