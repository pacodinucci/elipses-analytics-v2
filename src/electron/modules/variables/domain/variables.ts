// src/electron/modules/variables/domain/variables.ts

export type GrupoVariableScope =
  | "PROYECTO"
  | "POZO"
  | "CAPA"
  | "ELIPSE"
  | "ESCENARIO"
  | "SIMULACION"
  | "UNIDADES"
  | "MAPA";

export interface CreateGrupoVariableInput {
  id: string;
  proyectoId: string;
  nombre: string;
  orden: number;
  scope?: GrupoVariableScope;
  extrasJson?: Record<string, unknown>;
}

export interface CreateVariableInput {
  id: string;
  grupoVariableId: string;
  nombre: string;
  codigo: string;
  tipoDato: string;
  configJson: unknown;
  extrasJson?: Record<string, unknown>;
}

export interface UpsertUnidadInput {
  id?: string;
  proyectoId: string;
  unidad: string;
  configJson?: unknown;
  extrasJson?: Record<string, unknown>;
}

function requireString(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function requireFiniteNumber(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be finite`);
  }
}

function requirePlainObject(value: unknown, field: string): void {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

export function validateCreateGrupoVariableInput(
  input: CreateGrupoVariableInput,
): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.nombre, "nombre");
  requireFiniteNumber(input.orden, "orden");

  if (input.scope) {
    const allowed: GrupoVariableScope[] = [
      "PROYECTO",
      "POZO",
      "CAPA",
      "ELIPSE",
      "ESCENARIO",
      "SIMULACION",
      "UNIDADES",
      "MAPA",
    ];
    if (!allowed.includes(input.scope)) {
      throw new Error(`scope must be one of: ${allowed.join(", ")}`);
    }
  }

  if (input.extrasJson != null) {
    requirePlainObject(input.extrasJson, "extrasJson");
  }
}

export function validateCreateVariableInput(input: CreateVariableInput): void {
  requireString(input.id, "id");
  requireString(input.grupoVariableId, "grupoVariableId");
  requireString(input.nombre, "nombre");
  requireString(input.codigo, "codigo");
  requireString(input.tipoDato, "tipoDato");
  // configJson: lo dejamos flexible (serializable)
  if (input.extrasJson != null) {
    requirePlainObject(input.extrasJson, "extrasJson");
  }
}

export function validateUpsertUnidadInput(input: UpsertUnidadInput): void {
  requireString(input.proyectoId, "proyectoId");
  requireString(input.unidad, "unidad");

  if (input.extrasJson != null) {
    requirePlainObject(input.extrasJson, "extrasJson");
  }
}
