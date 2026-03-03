// src/electron/modules/simulations/domain/simulation.ts
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

  // ✅ schema v1 + models.ts: requerido
  setEstadoPozosId: string;
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
  requireString(input.escenarioSimulacionId, "escenarioSimulacionId");
  requireString(input.setEstadoPozosId, "setEstadoPozosId");
}

export type SimulationEntity = Simulacion;
export type SimulationTypeEntity = TipoSimulacion;
