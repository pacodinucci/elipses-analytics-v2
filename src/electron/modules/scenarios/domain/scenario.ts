// src/electron/modules/scenarios/domain/scenario.ts
import type { Escenario, TipoEscenario } from "../../../backend/models.js";

export interface CreateTipoEscenarioInput {
  id: string;
  nombre: string;
}

export interface CreateEscenarioInput {
  id: string;
  proyectoId: string;
  tipoEscenarioId: string;
  nombre: string;
}

export function validateCreateTipoEscenarioInput(
  input: CreateTipoEscenarioInput,
): void {
  if (!input.id || !input.nombre) {
    throw new Error("TipoEscenario requires id and nombre");
  }
}

export function validateCreateEscenarioInput(
  input: CreateEscenarioInput,
): void {
  if (
    !input.id ||
    !input.proyectoId ||
    !input.tipoEscenarioId ||
    !input.nombre
  ) {
    throw new Error(
      "Escenario requires id, proyectoId, tipoEscenarioId and nombre",
    );
  }
}

export type ScenarioEntity = Escenario;
export type ScenarioTypeEntity = TipoEscenario;
