export interface CreateGrupoVariableInput {
  id: string;
  nombre: string;
  orden: number;
}

export interface CreateVariableInput {
  id: string;
  grupoVariableId: string;
  unidadesId: string;
  nombre: string;
  codigo: string;
  tipoDato: string;
  unidad: string;
  configJson: unknown;
}

function requireString(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

export function validateCreateGrupoVariableInput(input: CreateGrupoVariableInput): void {
  requireString(input.id, "id");
  requireString(input.nombre, "nombre");
  if (!Number.isFinite(input.orden)) throw new Error("orden must be finite");
}

export function validateCreateVariableInput(input: CreateVariableInput): void {
  requireString(input.id, "id");
  requireString(input.grupoVariableId, "grupoVariableId");
  requireString(input.unidadesId, "unidadesId");
  requireString(input.nombre, "nombre");
  requireString(input.codigo, "codigo");
  requireString(input.tipoDato, "tipoDato");
  requireString(input.unidad, "unidad");
}
