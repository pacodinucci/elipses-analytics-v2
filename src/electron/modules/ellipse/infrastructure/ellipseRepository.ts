import type { ElipseValor, ElipseVariable } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateElipseValorInput,
  CreateElipseVariableInput,
} from "../domain/ellipse.js";

function mapVariable(row: Record<string, unknown>): ElipseVariable {
  return { id: String(row.id), nombre: String(row.nombre) };
}

function mapValor(row: Record<string, unknown>): ElipseValor {
  return {
    id: String(row.id),
    simulacionId: String(row.simulacionId),
    elipseVariableId: String(row.elipseVariableId),
    valor: Number(row.valor),
  };
}

export class EllipseRepository {
  async createVariable(
    input: CreateElipseVariableInput,
  ): Promise<ElipseVariable> {
    await databaseService.run(
      "INSERT INTO ElipseVariable (id, nombre) VALUES (?, ?)",
      [input.id, input.nombre],
    );

    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM ElipseVariable WHERE id = ? LIMIT 1",
      [input.id],
    );

    if (rows.length === 0) throw new Error("ElipseVariable creation failed");
    return mapVariable(rows[0]);
  }

  async listVariables(): Promise<ElipseVariable[]> {
    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM ElipseVariable ORDER BY nombre ASC",
    );
    return rows.map(mapVariable);
  }

  async createValor(input: CreateElipseValorInput): Promise<ElipseValor> {
    await databaseService.run(
      "INSERT INTO ElipseValor (id, simulacionId, elipseVariableId, valor) VALUES (?, ?, ?, ?)",
      [input.id, input.simulacionId, input.elipseVariableId, input.valor],
    );

    const rows = await databaseService.readAll(
      "SELECT id, simulacionId, elipseVariableId, valor FROM ElipseValor WHERE id = ? LIMIT 1",
      [input.id],
    );

    if (rows.length === 0) throw new Error("ElipseValor creation failed");
    return mapValor(rows[0]);
  }

  async listValoresBySimulacion(simulacionId: string): Promise<ElipseValor[]> {
    const rows = await databaseService.readAll(
      "SELECT id, simulacionId, elipseVariableId, valor FROM ElipseValor WHERE simulacionId = ? ORDER BY id ASC",
      [simulacionId],
    );
    return rows.map(mapValor);
  }
}
