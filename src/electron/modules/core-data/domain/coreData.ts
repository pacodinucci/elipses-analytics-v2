// src/electron/modules/core-data/domain/coreData.ts

export interface CreateProyectoInput {
  id: string;
  nombre: string;
  alias: string;
  limitesTemporalDesde: string;
  limitesTemporalHasta: string;

  // ✅ nullable: se define luego de cargar pozos
  arealMinX: number | null;
  arealMinY: number | null;
  arealMaxX: number | null;
  arealMaxY: number | null;
  arealCRS: string | null;

  grillaNx: number;
  grillaNy: number;

  // ✅ nullable: depende del areal
  grillaCellSizeX: number | null;
  grillaCellSizeY: number | null;

  // ✅ fijo: "m"
  grillaUnidad: string;
}

/**
 * ✅ Bootstrap mínimo:
 * - no CRS (queda null)
 * - no unidad (queda "m")
 * - un solo input para grilla Nx=Ny=gridDim
 */
export interface CreateProyectoBootstrapInput {
  nombre: string;
  limitesTemporalDesde: string;
  limitesTemporalHasta: string;
  gridDim: number; // ✅ Nx=Ny
}

/**
 * ✅ Recalcular areal desde pozos + márgenes
 * (CRS queda null por ahora)
 */
export interface RecomputeProyectoArealFromPozosInput {
  proyectoId: string;
  margenX: number;
  margenY: number;
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
export interface BulkPozoCapaRowInput {
  id: string;
  rowIndex: number;
  rowNumber: number;
  pozoId: string;
  capaId: string;
  tope: number;
  base: number;
}

export interface BulkUpsertPozoCapaInput {
  proyectoId: string;
  rows: BulkPozoCapaRowInput[];
}

export interface BulkUpsertPozoCapaResult {
  created: number;
  failed: Array<{
    rowIndex: number;
    rowNumber: number;
    error: string;
  }>;
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

function requireNullableFiniteNumber(
  value: number | null,
  fieldName: string,
): void {
  if (value == null) return;
  requireFiniteNumber(value, fieldName);
}

export function validateCreateProyectoInput(input: CreateProyectoInput): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
  requireString(input.alias, "alias");
  requireString(input.limitesTemporalDesde, "limitesTemporalDesde");
  requireString(input.limitesTemporalHasta, "limitesTemporalHasta");
  requireString(input.grillaUnidad, "grillaUnidad");

  requireFiniteNumber(input.grillaNx, "grillaNx");
  requireFiniteNumber(input.grillaNy, "grillaNy");

  requireNullableFiniteNumber(input.arealMinX, "arealMinX");
  requireNullableFiniteNumber(input.arealMinY, "arealMinY");
  requireNullableFiniteNumber(input.arealMaxX, "arealMaxX");
  requireNullableFiniteNumber(input.arealMaxY, "arealMaxY");
  requireNullableFiniteNumber(input.grillaCellSizeX, "grillaCellSizeX");
  requireNullableFiniteNumber(input.grillaCellSizeY, "grillaCellSizeY");

  // Si hay areal, CRS debería existir (aunque hoy lo dejamos null por decisión de negocio)
  const hasAreal =
    input.arealMinX != null ||
    input.arealMinY != null ||
    input.arealMaxX != null ||
    input.arealMaxY != null;

  if (hasAreal && input.arealCRS != null && !input.arealCRS.trim()) {
    throw new Error("arealCRS cannot be empty");
  }
}

export function validateCreateProyectoBootstrapInput(
  input: CreateProyectoBootstrapInput,
): void {
  requireString(input.nombre, "nombre");
  requireString(input.limitesTemporalDesde, "limitesTemporalDesde");
  requireString(input.limitesTemporalHasta, "limitesTemporalHasta");
  requireFiniteNumber(input.gridDim, "gridDim");

  if (input.gridDim <= 0) {
    throw new Error("gridDim must be greater than zero");
  }
  if (!Number.isInteger(input.gridDim)) {
    throw new Error("gridDim must be an integer");
  }
}

export function validateRecomputeProyectoArealFromPozosInput(
  input: RecomputeProyectoArealFromPozosInput,
): void {
  requireString(input.proyectoId, "proyectoId");
  requireFiniteNumber(input.margenX, "margenX");
  requireFiniteNumber(input.margenY, "margenY");

  if (input.margenX < 0 || input.margenY < 0) {
    throw new Error("margenes must be >= 0");
  }
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



export function validateBulkUpsertPozoCapaInput(
  input: BulkUpsertPozoCapaInput,
): void {
  requireString(input.proyectoId, "proyectoId");
  if (!Array.isArray(input.rows)) {
    throw new Error("rows must be an array");
  }

  for (let i = 0; i < input.rows.length; i += 1) {
    const row = input.rows[i];
    requireString(row.id, `rows[${i}].id`);
    requireString(row.pozoId, `rows[${i}].pozoId`);
    requireString(row.capaId, `rows[${i}].capaId`);
    requireFiniteNumber(row.tope, `rows[${i}].tope`);
    requireFiniteNumber(row.base, `rows[${i}].base`);
    requireFiniteNumber(row.rowIndex, `rows[${i}].rowIndex`);
    requireFiniteNumber(row.rowNumber, `rows[${i}].rowNumber`);

    if (!Number.isInteger(row.rowIndex) || row.rowIndex < 0) {
      throw new Error(`rows[${i}].rowIndex must be a non-negative integer`);
    }

    if (!Number.isInteger(row.rowNumber) || row.rowNumber <= 0) {
      throw new Error(`rows[${i}].rowNumber must be a positive integer`);
    }
  }
}
