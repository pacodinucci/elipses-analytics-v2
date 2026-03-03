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

    // ✅ models.ts usa snake_case
    agua_iny: Number(row.agua_iny),
  };
}

export class ProductionRepository {
  async create(input: CreateProduccionInput): Promise<Produccion> {
    const aguaIny = (input as any).aguaIny ?? (input as any).agua_iny ?? 0;

    await databaseService.run(
      `INSERT INTO Produccion (
        id, proyectoId, pozoId, capaId, fecha, petroleo, agua, gas, agua_iny
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        (input as any).id,
        (input as any).proyectoId,
        (input as any).pozoId,
        (input as any).capaId,
        (input as any).fecha,
        (input as any).petroleo,
        (input as any).agua,
        (input as any).gas,
        aguaIny,
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, pozoId, capaId, fecha, petroleo, agua, gas, agua_iny
       FROM Produccion
       WHERE id = ?
       LIMIT 1`,
      [(input as any).id],
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
      [proyectoId],
    );

    return rows.map(mapProduccion);
  }
}
