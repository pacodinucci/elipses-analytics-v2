import type {
  Simulacion,
  SimulacionEscenario,
  TipoSimulacion,
} from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateSimulacionInput,
  CreateTipoSimulacionInput,
  LinkSimulacionEscenarioInput,
} from "../domain/simulation.js";

function rowToSimulationType(row: Record<string, unknown>): TipoSimulacion {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
  };
}

function rowToSimulation(row: Record<string, unknown>): Simulacion {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    tipoSimulacionId: String(row.tipoSimulacionId),
    nombre: String(row.nombre),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    extrasJson:
      row.extrasJson && typeof row.extrasJson === "object"
        ? (row.extrasJson as Record<string, unknown>)
        : undefined,
  };
}

function rowToSimulationScenarioLink(
  row: Record<string, unknown>,
): SimulacionEscenario {
  return {
    id: String(row.id),
    simulacionId: String(row.simulacionId),
    escenarioId: String(row.escenarioId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    extrasJson:
      row.extrasJson && typeof row.extrasJson === "object"
        ? (row.extrasJson as Record<string, unknown>)
        : undefined,
  };
}

export class SimulationRepository {
  async createTipoSimulacion(
    input: CreateTipoSimulacionInput,
  ): Promise<TipoSimulacion> {
    await databaseService.run(
      "INSERT INTO TipoSimulacion (id, nombre) VALUES (?, ?)",
      [input.id, input.nombre],
    );

    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM TipoSimulacion WHERE id = ? LIMIT 1",
      [input.id],
    );

    if (rows.length === 0) throw new Error("TipoSimulacion creation failed");
    return rowToSimulationType(rows[0]);
  }

  async listTiposSimulacion(): Promise<TipoSimulacion[]> {
    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM TipoSimulacion ORDER BY nombre ASC",
    );
    return rows.map(rowToSimulationType);
  }

  async createSimulacion(input: CreateSimulacionInput): Promise<Simulacion> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Simulacion (
        id, proyectoId, tipoSimulacionId, nombre, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.tipoSimulacionId,
        input.nombre,
        now,
        now,
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoSimulacionId, nombre, createdAt, updatedAt, extrasJson
       FROM Simulacion
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("Simulacion creation failed");
    return rowToSimulation(rows[0]);
  }

  async listSimulacionesByProyecto(proyectoId: string): Promise<Simulacion[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoSimulacionId, nombre, createdAt, updatedAt, extrasJson
       FROM Simulacion
       WHERE proyectoId = ?
       ORDER BY createdAt DESC`,
      [proyectoId],
    );

    return rows.map(rowToSimulation);
  }

  async getSimulacionById(simulacionId: string): Promise<Simulacion | null> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoSimulacionId, nombre, createdAt, updatedAt, extrasJson
       FROM Simulacion
       WHERE id = ?
       LIMIT 1`,
      [simulacionId],
    );

    if (rows.length === 0) return null;
    return rowToSimulation(rows[0]);
  }

  async getSimulacionEscenarioBySimulacionId(
    simulacionId: string,
  ): Promise<SimulacionEscenario | null> {
    const rows = await databaseService.readAll(
      `SELECT id, simulacionId, escenarioId, createdAt, updatedAt, extrasJson
       FROM SimulacionEscenario
       WHERE simulacionId = ?
       LIMIT 1`,
      [simulacionId],
    );

    if (rows.length === 0) return null;
    return rowToSimulationScenarioLink(rows[0]);
  }

  async linkSimulacionEscenario(
    input: LinkSimulacionEscenarioInput,
  ): Promise<SimulacionEscenario> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO SimulacionEscenario (
        id, simulacionId, escenarioId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?)`,
      [input.id, input.simulacionId, input.escenarioId, now, now],
    );

    const rows = await databaseService.readAll(
      `SELECT id, simulacionId, escenarioId, createdAt, updatedAt, extrasJson
       FROM SimulacionEscenario
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) {
      throw new Error("SimulacionEscenario link failed");
    }

    return rowToSimulationScenarioLink(rows[0]);
  }
}
