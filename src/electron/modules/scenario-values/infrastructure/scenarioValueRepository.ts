import type { ValorEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";

function mapValorEscenario(row: Record<string, unknown>): ValorEscenario {
  return {
    id: String(row.id),
    escenarioId: String(row.escenarioId),
    pozoId: String(row.pozoId),
    capaId: String(row.capaId),
    fecha: String(row.fecha),
    petroleo: Number(row.petroleo),
    agua: Number(row.agua),
    gas: Number(row.gas),
    inyeccionGas: Number(row.inyeccionGas),
    inyeccionAgua: Number(row.inyeccionAgua),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class ScenarioValueRepository {
  async create(input: CreateValorEscenarioInput): Promise<ValorEscenario> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO ValorEscenario (
        id, escenarioId, pozoId, capaId, fecha,
        petroleo, agua, gas, inyeccionGas, inyeccionAgua,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.escenarioId,
        input.pozoId,
        input.capaId,
        input.fecha,
        input.petroleo,
        input.agua,
        input.gas,
        input.inyeccionGas,
        input.inyeccionAgua,
        now,
        now,
      ]
    );

    const rows = await databaseService.readAll(
      `SELECT id, escenarioId, pozoId, capaId, fecha, petroleo, agua, gas, inyeccionGas, inyeccionAgua, createdAt, updatedAt
       FROM ValorEscenario
       WHERE id = ?
       LIMIT 1`,
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("ValorEscenario creation failed");
    }

    return mapValorEscenario(rows[0]);
  }

  async listByEscenario(escenarioId: string): Promise<ValorEscenario[]> {
    const rows = await databaseService.readAll(
      `SELECT id, escenarioId, pozoId, capaId, fecha, petroleo, agua, gas, inyeccionGas, inyeccionAgua, createdAt, updatedAt
       FROM ValorEscenario
       WHERE escenarioId = ?
       ORDER BY fecha ASC, createdAt ASC`,
      [escenarioId]
    );

    return rows.map(mapValorEscenario);
  }
}
