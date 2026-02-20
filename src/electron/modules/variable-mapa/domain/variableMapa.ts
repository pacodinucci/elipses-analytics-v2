export interface CreateVariableMapaInput {
  id: string;
  nombre: string;
}

export function validateCreateVariableMapaInput(input: CreateVariableMapaInput): void {
  if (!input.id || !input.id.trim()) {
    throw new Error("id is required");
  }

  if (!input.nombre || !input.nombre.trim()) {
    throw new Error("nombre is required");
  }
}
