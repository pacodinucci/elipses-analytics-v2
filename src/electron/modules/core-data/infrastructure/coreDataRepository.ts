import type { Capa, Pozo, PozoCapa, Proyecto, Unidades } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateCapaInput,
  CreatePozoCapaInput,
  CreatePozoInput,
  CreateProyectoInput,
  CreateUnidadesInput,
} from "../domain/coreData.js";

function mapProyecto(row: Record<string, unknown>): Proyecto {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    alias: String(row.alias),
    limitesTemporalDesde: String(row.limitesTemporalDesde),
    limitesTemporalHasta: String(row.limitesTemporalHasta),
    arealMinX: Number(row.arealMinX),
    arealMinY: Number(row.arealMinY),
    arealMaxX: Number(row.arealMaxX),
    arealMaxY: Number(row.arealMaxY),
    arealCRS: String(row.arealCRS),
    grillaNx: Number(row.grillaNx),
    grillaNy: Number(row.grillaNy),
    grillaCellSizeX: Number(row.grillaCellSizeX),
    grillaCellSizeY: Number(row.grillaCellSizeY),
    grillaUnidad: String(row.grillaUnidad),
    unidadesId: String(row.unidadesId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapUnidades(row: Record<string, unknown>): Unidades {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapCapa(row: Record<string, unknown>): Capa {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    nombre: String(row.nombre),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapPozo(row: Record<string, unknown>): Pozo {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    nombre: String(row.nombre),
    x: Number(row.x),
    y: Number(row.y),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapPozoCapa(row: Record<string, unknown>): PozoCapa {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    pozoId: String(row.pozoId),
    capaId: String(row.capaId),
    tope: Number(row.tope),
    base: Number(row.base),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class CoreDataRepository {
  async createUnidades(input: CreateUnidadesInput): Promise<Unidades> {
    const now = new Date().toISOString();

    await databaseService.run(
      "INSERT INTO Unidades (id, proyectoId, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      [input.id, input.proyectoId, now, now]
    );

    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, createdAt, updatedAt FROM Unidades WHERE id = ? LIMIT 1",
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("Unidades creation failed");
    }

    return mapUnidades(rows[0]);
  }

  async listUnidadesByProject(proyectoId: string): Promise<Unidades[]> {
    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, createdAt, updatedAt FROM Unidades WHERE proyectoId = ? ORDER BY createdAt ASC",
      [proyectoId]
    );

    return rows.map(mapUnidades);
  }

  async createProyecto(input: CreateProyectoInput): Promise<Proyecto> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Proyecto (
        id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        unidadesId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.nombre,
        input.alias,
        input.limitesTemporalDesde,
        input.limitesTemporalHasta,
        input.arealMinX,
        input.arealMinY,
        input.arealMaxX,
        input.arealMaxY,
        input.arealCRS,
        input.grillaNx,
        input.grillaNy,
        input.grillaCellSizeX,
        input.grillaCellSizeY,
        input.grillaUnidad,
        input.unidadesId,
        now,
        now,
      ]
    );

    const rows = await databaseService.readAll(
      `SELECT id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        unidadesId, createdAt, updatedAt
       FROM Proyecto WHERE id = ? LIMIT 1`,
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("Proyecto creation failed");
    }

    return mapProyecto(rows[0]);
  }

  async listProyectos(): Promise<Proyecto[]> {
    const rows = await databaseService.readAll(
      `SELECT id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        unidadesId, createdAt, updatedAt
       FROM Proyecto ORDER BY createdAt ASC`
    );

    return rows.map(mapProyecto);
  }

  async createCapa(input: CreateCapaInput): Promise<Capa> {
    const now = new Date().toISOString();

    await databaseService.run(
      "INSERT INTO Capa (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [input.id, input.proyectoId, input.nombre, now, now]
    );

    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, nombre, createdAt, updatedAt FROM Capa WHERE id = ? LIMIT 1",
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("Capa creation failed");
    }

    return mapCapa(rows[0]);
  }

  async listCapasByProject(proyectoId: string): Promise<Capa[]> {
    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, nombre, createdAt, updatedAt FROM Capa WHERE proyectoId = ? ORDER BY createdAt ASC",
      [proyectoId]
    );

    return rows.map(mapCapa);
  }

  async createPozo(input: CreatePozoInput): Promise<Pozo> {
    const now = new Date().toISOString();

    await databaseService.run(
      "INSERT INTO Pozo (id, proyectoId, nombre, x, y, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [input.id, input.proyectoId, input.nombre, input.x, input.y, now, now]
    );

    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, nombre, x, y, createdAt, updatedAt FROM Pozo WHERE id = ? LIMIT 1",
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("Pozo creation failed");
    }

    return mapPozo(rows[0]);
  }

  async listPozosByProject(proyectoId: string): Promise<Pozo[]> {
    const rows = await databaseService.readAll(
      "SELECT id, proyectoId, nombre, x, y, createdAt, updatedAt FROM Pozo WHERE proyectoId = ? ORDER BY createdAt ASC",
      [proyectoId]
    );

    return rows.map(mapPozo);
  }

  async createPozoCapa(input: CreatePozoCapaInput): Promise<PozoCapa> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO PozoCapa (id, proyectoId, pozoId, capaId, tope, base, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.proyectoId, input.pozoId, input.capaId, input.tope, input.base, now, now]
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, pozoId, capaId, tope, base, createdAt, updatedAt
       FROM PozoCapa WHERE id = ? LIMIT 1`,
      [input.id]
    );

    if (rows.length === 0) {
      throw new Error("PozoCapa creation failed");
    }

    return mapPozoCapa(rows[0]);
  }

  async listPozoCapaByProject(proyectoId: string): Promise<PozoCapa[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, pozoId, capaId, tope, base, createdAt, updatedAt
       FROM PozoCapa WHERE proyectoId = ? ORDER BY createdAt ASC`,
      [proyectoId]
    );

    return rows.map(mapPozoCapa);
  }
}
