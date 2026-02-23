import type { Mapa } from "../../../backend/models.js";

export type MapGrid = number[][];

export interface UpsertMapInput {
  id: string;
  proyectoId: string;
  capaId: string;
  grupoVariableId: string;
  xedges: number[];
  yedges: number[];
  grid: MapGrid;
}

export function validateMapInput(input: UpsertMapInput): void {
  if (
    !input.id ||
    !input.proyectoId ||
    !input.capaId ||
    !input.grupoVariableId
  ) {
    throw new Error(
      "Map id, proyectoId, capaId and grupoVariableId are required",
    );
  }

  if (
    !Array.isArray(input.xedges) ||
    !Array.isArray(input.yedges) ||
    !Array.isArray(input.grid)
  ) {
    throw new Error("Map xedges, yedges and grid must be arrays");
  }
}

export type MapEntity = Mapa;
