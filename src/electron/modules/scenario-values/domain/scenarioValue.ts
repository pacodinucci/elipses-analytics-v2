export interface CreateValorEscenarioInput {
  id: string;
  escenarioId: string;
  pozoId: string;
  capaId: string;
  fecha: string;
  petroleo: number;
  agua: number;
  gas: number;
  inyeccionGas: number;
  inyeccionAgua: number;
}

function requireString(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
}

export function validateCreateValorEscenarioInput(input: CreateValorEscenarioInput): void {
  requireString(input.id, "id");
  requireString(input.escenarioId, "escenarioId");
  requireString(input.pozoId, "pozoId");
  requireString(input.capaId, "capaId");
  requireString(input.fecha, "fecha");
  requireFinite(input.petroleo, "petroleo");
  requireFinite(input.agua, "agua");
  requireFinite(input.gas, "gas");
  requireFinite(input.inyeccionGas, "inyeccionGas");
  requireFinite(input.inyeccionAgua, "inyeccionAgua");
}
