export interface CreateProyectoInput {
  id: string;
  nombre: string;
  alias: string;
  limitesTemporalDesde: string;
  limitesTemporalHasta: string;
  arealMinX: number;
  arealMinY: number;
  arealMaxX: number;
  arealMaxY: number;
  arealCRS: string;
  grillaNx: number;
  grillaNy: number;
  grillaCellSizeX: number;
  grillaCellSizeY: number;
  grillaUnidad: string;
  unidadesId: string;
}

export interface CreateProyectoBootstrapInput {
  nombre: string;
  limitesTemporalDesde: string;
  limitesTemporalHasta: string;
  arealMinX: number;
  arealMinY: number;
  arealMaxX: number;
  arealMaxY: number;
  arealCRS: string;
  grillaNx: number;
  grillaNy: number;
  grillaUnidad: string;
}

export interface CreateUnidadesInput {
  id: string;
  proyectoId: string;
}

export interface CreateCapaInput {
  id: string;
  proyectoId: string;
  nombre: string;
}

export interface CreatePozoInput {
  id: string;
  proyectoId: string;
  nombre: string;
  x: number;
  y: number;
}

export interface CreatePozoCapaInput {
  id: string;
  proyectoId: string;
  pozoId: string;
  capaId: string;
  tope: number;
  base: number;
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

export function validateCreateProyectoInput(input: CreateProyectoInput): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
  requireString(input.alias, "alias");
  requireString(input.limitesTemporalDesde, "limitesTemporalDesde");
  requireString(input.limitesTemporalHasta, "limitesTemporalHasta");
  requireString(input.arealCRS, "arealCRS");
  requireString(input.grillaUnidad, "grillaUnidad");
  requireString(input.unidadesId, "unidadesId");

  requireFiniteNumber(input.arealMinX, "arealMinX");
  requireFiniteNumber(input.arealMinY, "arealMinY");
  requireFiniteNumber(input.arealMaxX, "arealMaxX");
  requireFiniteNumber(input.arealMaxY, "arealMaxY");
  requireFiniteNumber(input.grillaNx, "grillaNx");
  requireFiniteNumber(input.grillaNy, "grillaNy");
  requireFiniteNumber(input.grillaCellSizeX, "grillaCellSizeX");
  requireFiniteNumber(input.grillaCellSizeY, "grillaCellSizeY");
}

export function validateCreateProyectoBootstrapInput(input: CreateProyectoBootstrapInput): void {
  requireString(input.nombre, "nombre");
  requireString(input.limitesTemporalDesde, "limitesTemporalDesde");
  requireString(input.limitesTemporalHasta, "limitesTemporalHasta");
  requireString(input.arealCRS, "arealCRS");
  requireString(input.grillaUnidad, "grillaUnidad");

  requireFiniteNumber(input.arealMinX, "arealMinX");
  requireFiniteNumber(input.arealMinY, "arealMinY");
  requireFiniteNumber(input.arealMaxX, "arealMaxX");
  requireFiniteNumber(input.arealMaxY, "arealMaxY");
  requireFiniteNumber(input.grillaNx, "grillaNx");
  requireFiniteNumber(input.grillaNy, "grillaNy");

  if (input.arealMaxX <= input.arealMinX) {
    throw new Error("arealMaxX must be greater than arealMinX");
  }

  if (input.arealMaxY <= input.arealMinY) {
    throw new Error("arealMaxY must be greater than arealMinY");
  }

  if (input.grillaNx <= 0 || input.grillaNy <= 0) {
    throw new Error("grid dimensions must be greater than zero");
  }
}

export function validateCreateUnidadesInput(input: CreateUnidadesInput): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
}

export function validateCreateCapaInput(input: CreateCapaInput): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.nombre, "nombre");
}

export function validateCreatePozoInput(input: CreatePozoInput): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.nombre, "nombre");
  requireFiniteNumber(input.x, "x");
  requireFiniteNumber(input.y, "y");
}

export function validateCreatePozoCapaInput(input: CreatePozoCapaInput): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.pozoId, "pozoId");
  requireString(input.capaId, "capaId");
  requireFiniteNumber(input.tope, "tope");
  requireFiniteNumber(input.base, "base");

  if (input.tope >= input.base) {
    throw new Error("tope must be lower than base");
  }
}
