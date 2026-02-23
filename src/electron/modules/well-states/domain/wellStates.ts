export interface CreateTipoEstadoPozoInput {
  id: string;
  nombre: string;
}

export interface CreateSetEstadoPozosInput {
  id: string;
  proyectoId: string;
  nombre: string;
}

export interface CreateSetEstadoPozosDetalleInput {
  id: string;
  setEstadoPozosId: string;
  pozoId: string;
  tipoEstadoPozoId: string;
}

function requireString(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

export function validateCreateTipoEstadoPozoInput(input: CreateTipoEstadoPozoInput): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
}

export function validateCreateSetEstadoPozosInput(input: CreateSetEstadoPozosInput): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.nombre, "nombre");
}

export function validateCreateSetEstadoPozosDetalleInput(input: CreateSetEstadoPozosDetalleInput): void {
  requireString(input.id, "id");
  requireString(input.setEstadoPozosId, "setEstadoPozosId");
  requireString(input.pozoId, "pozoId");
  requireString(input.tipoEstadoPozoId, "tipoEstadoPozoId");
}
