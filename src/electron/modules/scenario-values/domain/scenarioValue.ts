export interface CreateValorEscenarioInput {
  id: string;
  escenarioId: string;
  pozoId: string;
  capaId: string;
  fecha: string; // YYYY-MM-DD

  // ✅ pueden ser null según tipoEscenario
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
  if (value == null) return; // ✅ permitido
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
  requireString(input.capaId, "capaId");
  requireString(input.fecha, "fecha");

  // ✅ permitir nulls
  requireNullableFinite(input.petroleo, "petroleo");
  requireNullableFinite(input.agua, "agua");
  requireNullableFinite(input.gas, "gas");
  requireNullableFinite(input.inyeccionGas, "inyeccionGas");
  requireNullableFinite(input.inyeccionAgua, "inyeccionAgua");
}
