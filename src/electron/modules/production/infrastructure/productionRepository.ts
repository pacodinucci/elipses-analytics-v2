import type { Produccion } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { CreateProduccionInput } from "../domain/production.js";

function mapProduccion(row: Record<string, unknown>): Produccion {
  return {
    id: Number(row.id),
    proyectoId: String(row.proyectoId),
    pozoId: String(row.pozoId),
    capaId: String(row.capaId),
    fecha: String(row.fecha),
    petroleo: Number(row.petroleo),
    agua: Number(row.agua),
    gas: Number(row.gas),
    aguaIny: Number(row.agua_iny),
  };
}

export class ProductionRepository {
  async create(input: CreateProduccionInput): Promise<Produccion> {
    await databaseService.run(
      `INSERT INTO Produccion (
        id, proyectoId, pozoId, capaId, fecha, petroleo, agua, gas, agua_iny
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.pozoId,
        input.capaId,
        input.fecha,
        input.petroleo,
        input.agua,
        input.gas,
        input.aguaIny,
      ]
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, pozoId, capaId, fecha, petroleo, agua, gas, agua_iny
       FROM Produccion
       WHERE id = ?
       LIMIT 1`,
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("Produccion creation failed");
    }

    return mapProduccion(rows[0]);
  }

  async listByProject(proyectoId: string): Promise<Produccion[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, pozoId, capaId, fecha, petroleo, agua, gas, agua_iny
       FROM Produccion
       WHERE proyectoId = ?
       ORDER BY fecha ASC, id ASC`,
      [proyectoId]
    );

    return rows.map(mapProduccion);
  }
}
