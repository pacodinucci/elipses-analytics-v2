import type { Simulacion, TipoSimulacion } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { CreateSimulacionInput, CreateTipoSimulacionInput } from "../domain/simulation.js";

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
    escenarioSimulacionId: String(row.escenarioSimulacionId),
    setEstadoPozosId: String(row.setEstadoPozosId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class SimulationRepository {
  async createTipoSimulacion(input: CreateTipoSimulacionInput): Promise<TipoSimulacion> {
    await databaseService.run("INSERT INTO TipoSimulacion (id, nombre) VALUES (?, ?)", [
      input.id,
      input.nombre,
    ]);

    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM TipoSimulacion WHERE id = ? LIMIT 1",
      [input.id]
    );

    return rowToSimulationType(rows[0]);
  }

  async listTiposSimulacion(): Promise<TipoSimulacion[]> {
    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM TipoSimulacion ORDER BY nombre ASC"
    );

    return rows.map(rowToSimulationType);
  }

  async createSimulacion(input: CreateSimulacionInput): Promise<Simulacion> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Simulacion (
        id, proyectoId, tipoSimulacionId, escenarioSimulacionId, setEstadoPozosId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.tipoSimulacionId,
        input.escenarioSimulacionId,
        input.setEstadoPozosId,
        now,
        now,
      ]
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoSimulacionId, escenarioSimulacionId, setEstadoPozosId, createdAt, updatedAt
       FROM Simulacion
       WHERE id = ?
       LIMIT 1`,
      [input.id]
    );

    return rowToSimulation(rows[0]);
  }

  async listSimulacionesByProyecto(proyectoId: string): Promise<Simulacion[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoSimulacionId, escenarioSimulacionId, setEstadoPozosId, createdAt, updatedAt
       FROM Simulacion
       WHERE proyectoId = ?
       ORDER BY createdAt DESC`,
      [proyectoId]
    );

    return rows.map(rowToSimulation);
  }
}
