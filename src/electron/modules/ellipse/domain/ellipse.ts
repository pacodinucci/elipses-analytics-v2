export interface CreateElipseVariableInput {
  id: string;
  nombre: string;
}

export interface CreateElipseValorInput {
  id: string;
  simulacionId: string;
  elipseVariableId: string;
  valor: number;
}

function requireString(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

export function validateCreateElipseVariableInput(
  input: CreateElipseVariableInput,
): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
}

export function validateCreateElipseValorInput(
  input: CreateElipseValorInput,
): void {
  requireString(input.id, "id");
  requireString(input.simulacionId, "simulacionId");
  requireString(input.elipseVariableId, "elipseVariableId");
  if (!Number.isFinite(input.valor)) {
    throw new Error("valor must be a finite number");
  }
}
