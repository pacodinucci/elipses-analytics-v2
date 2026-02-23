export interface CreateProduccionInput {
  id: number;
  proyectoId: string;
  pozoId: string;
  capaId: string;
  fecha: string;
  petroleo: number;
  agua: number;
  gas: number;
  aguaIny: number;
}

function requireString(value: string, fieldName: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
}

function requireFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
}

export function validateCreateProduccionInput(input: CreateProduccionInput): void {
  if (!Number.isInteger(input.id) || input.id < 0) {
    throw new Error("id must be a non-negative integer");
  }

  requireString(input.proyectoId, "proyectoId");
  requireString(input.pozoId, "pozoId");
  requireString(input.capaId, "capaId");
  requireString(input.fecha, "fecha");

  requireFiniteNumber(input.petroleo, "petroleo");
  requireFiniteNumber(input.agua, "agua");
  requireFiniteNumber(input.gas, "gas");
  requireFiniteNumber(input.aguaIny, "aguaIny");
}
