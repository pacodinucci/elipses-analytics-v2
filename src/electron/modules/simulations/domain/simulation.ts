import type {
  Simulacion,
  SimulacionEscenario,
  TipoSimulacion,
} from "../../../backend/models.js";

export interface CreateTipoSimulacionInput {
  id: string;
  nombre: string;
}

export interface CreateSimulacionInput {
  id: string;
  proyectoId: string;
  tipoSimulacionId: string;
  nombre: string;
}

export interface LinkSimulacionEscenarioInput {
  id: string;
  simulacionId: string;
  escenarioId: string;
}

function requireString(value: unknown, field: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

export function validateCreateTipoSimulacionInput(
  input: CreateTipoSimulacionInput,
): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
}

export function validateCreateSimulacionInput(
  input: CreateSimulacionInput,
): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.tipoSimulacionId, "tipoSimulacionId");
  requireString(input.nombre, "nombre");
}

export function validateLinkSimulacionEscenarioInput(
  input: LinkSimulacionEscenarioInput,
): void {
  requireString(input.id, "id");
  requireString(input.simulacionId, "simulacionId");
  requireString(input.escenarioId, "escenarioId");
}

export type SimulationEntity = Simulacion;
export type SimulationTypeEntity = TipoSimulacion;
export type SimulationScenarioLinkEntity = SimulacionEscenario;
