export interface CreateTipoEstadoPozoInput {
  id: string;
  nombre: string;
}

export interface CreateSetEstadoPozosInput {
  id: string;
  proyectoId: string;
  simulacionId: string | null;
  nombre: string;
}

export interface CreateSetEstadoPozosDetalleInput {
  id: string;
  setEstadoPozosId: string;
  pozoId: string;
  capaId: string | null;
  fecha: string;
  tipoEstadoPozoId: string;
}

function requireString(value: unknown, field: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function optionalNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  if (t.toLowerCase() === "null" || t.toLowerCase() === "undefined")
    return null;
  return t;
}

export function validateCreateTipoEstadoPozoInput(
  input: CreateTipoEstadoPozoInput,
): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
}

export function validateCreateSetEstadoPozosInput(
  input: CreateSetEstadoPozosInput,
): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.nombre, "nombre");
  input.simulacionId = optionalNullableString(input.simulacionId);
}

export function validateCreateSetEstadoPozosDetalleInput(
  input: CreateSetEstadoPozosDetalleInput,
): void {
  requireString(input.id, "id");
  requireString(input.setEstadoPozosId, "setEstadoPozosId");
  requireString(input.pozoId, "pozoId");
  input.capaId = optionalNullableString(input.capaId);
  requireString(input.fecha, "fecha");
  requireString(input.tipoEstadoPozoId, "tipoEstadoPozoId");
}
