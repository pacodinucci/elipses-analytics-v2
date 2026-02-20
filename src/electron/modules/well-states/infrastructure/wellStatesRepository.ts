import type { SetEstadoPozos, SetEstadoPozosDetalle, TipoEstadoPozo } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateSetEstadoPozosDetalleInput,
  CreateSetEstadoPozosInput,
  CreateTipoEstadoPozoInput,
} from "../domain/wellStates.js";

function mapTipo(row: Record<string, unknown>): TipoEstadoPozo {
  return { id: String(row.id), nombre: String(row.nombre) };
}

function mapSet(row: Record<string, unknown>): SetEstadoPozos {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    nombre: String(row.nombre),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapDetalle(row: Record<string, unknown>): SetEstadoPozosDetalle {
  return {
    id: String(row.id),
    setEstadoPozosId: String(row.setEstadoPozosId),
    pozoId: String(row.pozoId),
    tipoEstadoPozoId: String(row.tipoEstadoPozoId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class WellStatesRepository {
  async createTipoEstadoPozo(input: CreateTipoEstadoPozoInput): Promise<TipoEstadoPozo> {
    await databaseService.run("INSERT INTO TipoEstadoPozo (id, nombre) VALUES (?, ?)", [input.id, input.nombre]);
    const rows = await databaseService.readAll("SELECT id, nombre FROM TipoEstadoPozo WHERE id = ? LIMIT 1", [input.id]);
    if (rows.length === 0) throw new Error("TipoEstadoPozo creation failed");
    return mapTipo(rows[0]);
  }

  async listTiposEstadoPozo(): Promise<TipoEstadoPozo[]> {
    const rows = await databaseService.readAll("SELECT id, nombre FROM TipoEstadoPozo ORDER BY nombre ASC");
    return rows.map(mapTipo);
  }

  async createSetEstadoPozos(input: CreateSetEstadoPozosInput): Promise<SetEstadoPozos> {
    const now = new Date().toISOString();
    await databaseService.run(
      "INSERT INTO SetEstadoPozos (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [input.id, input.proyectoId, input.nombre, now, now]
    );
    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, nombre, createdAt, updatedAt FROM SetEstadoPozos WHERE id = ? LIMIT 1",
      [input.id]
    );
    if (rows.length === 0) throw new Error("SetEstadoPozos creation failed");
    return mapSet(rows[0]);
  }

  async listSetsEstadoPozosByProject(proyectoId: string): Promise<SetEstadoPozos[]> {
    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, nombre, createdAt, updatedAt FROM SetEstadoPozos WHERE proyectoId = ? ORDER BY createdAt ASC",
      [proyectoId]
    );
    return rows.map(mapSet);
  }

  async createSetEstadoPozosDetalle(input: CreateSetEstadoPozosDetalleInput): Promise<SetEstadoPozosDetalle> {
    const now = new Date().toISOString();
    await databaseService.run(
      `INSERT INTO SetEstadoPozosDetalle (
        id, setEstadoPozosId, pozoId, tipoEstadoPozoId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.setEstadoPozosId, input.pozoId, input.tipoEstadoPozoId, now, now]
    );

    const rows = await databaseService.readAll(
      `SELECT id, setEstadoPozosId, pozoId, tipoEstadoPozoId, createdAt, updatedAt
       FROM SetEstadoPozosDetalle WHERE id = ? LIMIT 1`,
      [input.id]
    );

    if (rows.length === 0) throw new Error("SetEstadoPozosDetalle creation failed");
    return mapDetalle(rows[0]);
  }

  async listSetEstadoPozosDetalle(setEstadoPozosId: string): Promise<SetEstadoPozosDetalle[]> {
    const rows = await databaseService.readAll(
      `SELECT id, setEstadoPozosId, pozoId, tipoEstadoPozoId, createdAt, updatedAt
       FROM SetEstadoPozosDetalle WHERE setEstadoPozosId = ? ORDER BY createdAt ASC`,
      [setEstadoPozosId]
    );
    return rows.map(mapDetalle);
  }
}
