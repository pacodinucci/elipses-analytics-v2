import type { Escenario, TipoEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateEscenarioInput,
  CreateTipoEscenarioInput,
} from "../domain/scenario.js";

function rowToScenarioType(row: Record<string, unknown>): TipoEscenario {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
  };
}

function rowToScenario(row: Record<string, unknown>): Escenario {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    tipoEscenarioId: String(row.tipoEscenarioId),
    nombre: String(row.nombre),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class ScenarioRepository {
  async createTipoEscenario(
    input: CreateTipoEscenarioInput,
  ): Promise<TipoEscenario> {
    await databaseService.run(
      "INSERT INTO TipoEscenario (id, nombre) VALUES (?, ?)",
      [input.id, input.nombre],
    );

    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM TipoEscenario WHERE id = ? LIMIT 1",
      [input.id],
    );

    return rowToScenarioType(rows[0]);
  }

  async listTiposEscenario(): Promise<TipoEscenario[]> {
    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM TipoEscenario ORDER BY nombre ASC",
    );
    return rows.map(rowToScenarioType);
  }

  async createEscenario(input: CreateEscenarioInput): Promise<Escenario> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Escenario (
        id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.tipoEscenarioId,
        input.nombre,
        now,
        now,
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt
       FROM Escenario
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    return rowToScenario(rows[0]);
  }

  async listEscenariosByProyecto(proyectoId: string): Promise<Escenario[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt
       FROM Escenario
       WHERE proyectoId = ?
       ORDER BY createdAt DESC`,
      [proyectoId],
    );

    return rows.map(rowToScenario);
  }

  // ✅ NUEVO: lookup por id (para validación de valores)
  async getEscenarioById(escenarioId: string): Promise<Escenario | null> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt
       FROM Escenario
       WHERE id = ?
       LIMIT 1`,
      [escenarioId],
    );

    if (rows.length === 0) return null;
    return rowToScenario(rows[0]);
  }

  // ✅ NUEVO: lookup del tipo
  async getTipoEscenarioById(
    tipoEscenarioId: string,
  ): Promise<TipoEscenario | null> {
    const rows = await databaseService.readAll(
      `SELECT id, nombre
       FROM TipoEscenario
       WHERE id = ?
       LIMIT 1`,
      [tipoEscenarioId],
    );

    if (rows.length === 0) return null;
    return rowToScenarioType(rows[0]);
  }
}
