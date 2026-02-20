import type { Mapa } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { UpsertMapInput } from "../domain/map.js";

function mapRowToEntity(row: Record<string, unknown>): Mapa {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    capaId: String(row.capaId),
    variableMapaId: String(row.variableMapaId),
    xedges: JSON.parse(String(row.xedges)) as number[],
    yedges: JSON.parse(String(row.yedges)) as number[],
    grid: JSON.parse(String(row.grid)) as number[][],
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class MapRepository {
  async getByLayer(capaId: string, variableMapaId?: string): Promise<Mapa | null> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, capaId, variableMapaId, xedges, yedges, grid, createdAt, updatedAt
       FROM Mapa
       WHERE capaId = ?
       ${variableMapaId ? "AND variableMapaId = ?" : ""}
       LIMIT 1`,
      variableMapaId ? [capaId, variableMapaId] : [capaId]
    );

    if (rows.length === 0) {
      return null;
    }

    return mapRowToEntity(rows[0]);
  }

  async upsert(input: UpsertMapInput): Promise<Mapa> {
    const existing = await this.getByLayer(input.capaId);
    const now = new Date().toISOString();

    if (!existing) {
      await databaseService.run(
        `INSERT INTO Mapa (
          id, proyectoId, capaId, variableMapaId, xedges, yedges, grid, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.proyectoId,
          input.capaId,
          input.variableMapaId,
          JSON.stringify(input.xedges),
          JSON.stringify(input.yedges),
          JSON.stringify(input.grid),
          now,
          now,
        ]
      );
    } else {
      await databaseService.run(
        `UPDATE Mapa
         SET id = ?,
             proyectoId = ?,
             variableMapaId = ?,
             xedges = ?,
             yedges = ?,
             grid = ?,
             updatedAt = ?
         WHERE capaId = ?`,
        [
          input.id,
          input.proyectoId,
          input.variableMapaId,
          JSON.stringify(input.xedges),
          JSON.stringify(input.yedges),
          JSON.stringify(input.grid),
          now,
          input.capaId,
        ]
      );
    }

    const updated = await this.getByLayer(input.capaId, input.variableMapaId);
    if (!updated) {
      throw new Error("Map upsert failed");
    }

    return updated;
  }
}
