import type { GrupoVariable, Variable } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { CreateGrupoVariableInput, CreateVariableInput } from "../domain/variables.js";

function mapGrupo(row: Record<string, unknown>): GrupoVariable {
  return { id: String(row.id), nombre: String(row.nombre), orden: Number(row.orden) };
}

function mapVariable(row: Record<string, unknown>): Variable {
  return {
    id: String(row.id),
    grupoVariableId: String(row.grupoVariableId),
    unidadesId: String(row.unidadesId),
    nombre: String(row.nombre),
    codigo: String(row.codigo),
    tipoDato: String(row.tipoDato),
    unidad: String(row.unidad),
    configJson: JSON.parse(String(row.configJson)),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class VariablesRepository {
  async createGrupoVariable(input: CreateGrupoVariableInput): Promise<GrupoVariable> {
    await databaseService.run(
      "INSERT INTO GrupoVariable (id, nombre, orden) VALUES (?, ?, ?)",
      [input.id, input.nombre, input.orden]
    );
    const rows = await databaseService.readAll("SELECT id, nombre, orden FROM GrupoVariable WHERE id = ? LIMIT 1", [input.id]);
    if (rows.length === 0) throw new Error("GrupoVariable creation failed");
    return mapGrupo(rows[0]);
  }

  async listGrupoVariable(): Promise<GrupoVariable[]> {
    const rows = await databaseService.readAll("SELECT id, nombre, orden FROM GrupoVariable ORDER BY orden ASC, nombre ASC");
    return rows.map(mapGrupo);
  }

  async createVariable(input: CreateVariableInput): Promise<Variable> {
    const now = new Date().toISOString();
    await databaseService.run(
      `INSERT INTO Variable (
        id, grupoVariableId, unidadesId, nombre, codigo, tipoDato, unidad, configJson, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.grupoVariableId,
        input.unidadesId,
        input.nombre,
        input.codigo,
        input.tipoDato,
        input.unidad,
        JSON.stringify(input.configJson ?? {}),
        now,
        now,
      ]
    );
    const rows = await databaseService.readAll(
      `SELECT id, grupoVariableId, unidadesId, nombre, codigo, tipoDato, unidad, configJson, createdAt, updatedAt
       FROM Variable WHERE id = ? LIMIT 1`,
      [input.id]
    );
    if (rows.length === 0) throw new Error("Variable creation failed");
    return mapVariable(rows[0]);
  }

  async listVariableByUnidades(unidadesId: string): Promise<Variable[]> {
    const rows = await databaseService.readAll(
      `SELECT id, grupoVariableId, unidadesId, nombre, codigo, tipoDato, unidad, configJson, createdAt, updatedAt
       FROM Variable WHERE unidadesId = ? ORDER BY createdAt ASC`,
      [unidadesId]
    );
    return rows.map(mapVariable);
  }
}
