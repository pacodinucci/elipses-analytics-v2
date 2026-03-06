export interface CreateValorEscenarioInput {
  id: string;
  escenarioId: string;
  pozoId: string;
  capaId?: string | null;
  fecha: string; // YYYY-MM-DD

  petroleo?: number | null;
  agua?: number | null;
  gas?: number | null;
  inyeccionGas?: number | null;
  inyeccionAgua?: number | null;
}

function requireString(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function requireNullableFinite(
  value: number | null | undefined,
  field: string,
): void {
  if (value == null) return;
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number or null`);
  }
}

export function validateCreateValorEscenarioInput(
  input: CreateValorEscenarioInput,
): void {
  requireString(input.id, "id");
  requireString(input.escenarioId, "escenarioId");
  requireString(input.pozoId, "pozoId");
  requireString(input.fecha, "fecha");

  if (input.capaId != null && !String(input.capaId).trim()) {
    throw new Error("capaId must be a non-empty string or null");
  }

  requireNullableFinite(input.petroleo, "petroleo");
  requireNullableFinite(input.agua, "agua");
  requireNullableFinite(input.gas, "gas");
  requireNullableFinite(input.inyeccionGas, "inyeccionGas");
  requireNullableFinite(input.inyeccionAgua, "inyeccionAgua");
}
