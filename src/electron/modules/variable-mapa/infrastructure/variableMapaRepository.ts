import type { VariableMapa } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { CreateVariableMapaInput } from "../domain/variableMapa.js";

function mapVariableMapa(row: Record<string, unknown>): VariableMapa {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
  };
}

export class VariableMapaRepository {
  async create(input: CreateVariableMapaInput): Promise<VariableMapa> {
    await databaseService.run("INSERT INTO VariableMapa (id, nombre) VALUES (?, ?)", [
      input.id,
      input.nombre,
    ]);

    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM VariableMapa WHERE id = ? LIMIT 1",
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("VariableMapa creation failed");
    }

    return mapVariableMapa(rows[0]);
  }

  async list(): Promise<VariableMapa[]> {
    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM VariableMapa ORDER BY nombre ASC"
    );

    return rows.map(mapVariableMapa);
  }
}
