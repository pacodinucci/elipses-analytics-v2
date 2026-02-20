import type { Simulacion, TipoSimulacion } from "../../../backend/models.js";

export interface CreateTipoSimulacionInput {
  id: string;
  nombre: string;
}

export interface CreateSimulacionInput {
  id: string;
  proyectoId: string;
  tipoSimulacionId: string;
  escenarioSimulacionId: string;
  setEstadoPozosId: string;
}

export function validateCreateTipoSimulacionInput(input: CreateTipoSimulacionInput): void {
  if (!input.id || !input.nombre) {
    throw new Error("TipoSimulacion requires id and nombre");
  }
}

export function validateCreateSimulacionInput(input: CreateSimulacionInput): void {
  if (
    !input.id ||
    !input.proyectoId ||
    !input.tipoSimulacionId ||
    !input.escenarioSimulacionId ||
    !input.setEstadoPozosId
  ) {
    throw new Error(
      "Simulacion requires id, proyectoId, tipoSimulacionId, escenarioSimulacionId and setEstadoPozosId"
    );
  }
}

export type SimulationEntity = Simulacion;
export type SimulationTypeEntity = TipoSimulacion;
