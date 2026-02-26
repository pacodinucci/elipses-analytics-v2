export interface CreateElipseVariableInput {
  id: string;
  nombre: string;
}

export interface CreateElipseInput {
  id: string;
  proyectoId: string;
  capaId: string;
  pozoInyectorId?: string | null;
  pozoProductorId?: string | null;

  /**
   * Contorno sampleado (polígono) en coords del mapa.
   * x[i] y y[i] deben tener igual longitud.
   */
  x: number[];
  y: number[];
}

export interface CreateElipseValorInput {
  id: string;
  simulacionId: string;
  elipseId: string;
  elipseVariableId: string;
  valor: number;
}

function requireString(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function requireOptionalStringOrNull(
  value: string | null | undefined,
  field: string,
): void {
  if (value == null) return;
  if (!String(value).trim()) {
    throw new Error(`${field} must be a non-empty string or null`);
  }
}

function requireNumberArray(arr: unknown, field: string): number[] {
  if (!Array.isArray(arr)) throw new Error(`${field} must be an array`);
  const out = arr.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      throw new Error(`${field}[${i}] must be a finite number`);
    }
    return n;
  });
  return out;
}

export function validateCreateElipseVariableInput(
  input: CreateElipseVariableInput,
): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
}

export function validateCreateElipseInput(input: CreateElipseInput): void {
  requireString(input.id, "id");
  requireString(input.proyectoId, "proyectoId");
  requireString(input.capaId, "capaId");
  requireOptionalStringOrNull(input.pozoInyectorId, "pozoInyectorId");
  requireOptionalStringOrNull(input.pozoProductorId, "pozoProductorId");

  const x = requireNumberArray(input.x, "x");
  const y = requireNumberArray(input.y, "y");

  if (x.length !== y.length) {
    throw new Error("x and y must have the same length");
  }
  if (x.length < 3) {
    throw new Error("x and y must have at least 3 points");
  }
}

export function validateCreateElipseValorInput(
  input: CreateElipseValorInput,
): void {
  requireString(input.id, "id");
  requireString(input.simulacionId, "simulacionId");
  requireString(input.elipseId, "elipseId");
  requireString(input.elipseVariableId, "elipseVariableId");
  if (!Number.isFinite(input.valor)) {
    throw new Error("valor must be a finite number");
  }
}
