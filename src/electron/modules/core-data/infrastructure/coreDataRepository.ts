// src/electron/modules/core-data/infrastructure/coreDataRepository.ts
import type {
  Capa,
  Pozo,
  PozoCapa,
  Proyecto,
} from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateCapaInput,
  CreatePozoCapaInput,
  CreatePozoInput,
  CreateProyectoInput,
  RecomputeProyectoArealFromPozosInput,
} from "../domain/coreData.js";

function safeJson(value: unknown, fallback: unknown = {}) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function mapProyecto(row: Record<string, unknown>): Proyecto {
  const n = (v: unknown) => (v == null ? null : Number(v));
  const s = (v: unknown) => (v == null ? null : String(v));

  return {
    id: String(row.id),
    nombre: String(row.nombre),
    alias: String(row.alias),
    limitesTemporalDesde: String(row.limitesTemporalDesde),
    limitesTemporalHasta: String(row.limitesTemporalHasta),

    arealMinX: n(row.arealMinX),
    arealMinY: n(row.arealMinY),
    arealMaxX: n(row.arealMaxX),
    arealMaxY: n(row.arealMaxY),
    arealCRS: s(row.arealCRS),

    grillaNx: Number(row.grillaNx),
    grillaNy: Number(row.grillaNy),

    grillaCellSizeX: n(row.grillaCellSizeX),
    grillaCellSizeY: n(row.grillaCellSizeY),

    grillaUnidad: String(row.grillaUnidad),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),

    extrasJson:
      row.extrasJson != null
        ? typeof row.extrasJson === "string"
          ? (safeJson(row.extrasJson, {}) as any)
          : (row.extrasJson as any)
        : undefined,
  };
}

function mapCapa(row: Record<string, unknown>): Capa {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    nombre: String(row.nombre),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    extrasJson:
      row.extrasJson != null
        ? (safeJson(row.extrasJson, {}) as any)
        : undefined,
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
    extrasJson:
      row.extrasJson != null
        ? (safeJson(row.extrasJson, {}) as any)
        : undefined,
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
    extrasJson:
      row.extrasJson != null
        ? (safeJson(row.extrasJson, {}) as any)
        : undefined,
  };
}

export class CoreDataRepository {
  // ----------------------------
  // Proyecto
  // ----------------------------
  async createProyecto(input: CreateProyectoInput): Promise<Proyecto> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Proyecto (
        id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        createdAt, updatedAt, extrasJson
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

        now,
        now,
        JSON.stringify({}),
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT
        id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        createdAt, updatedAt, extrasJson
       FROM Proyecto
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("Proyecto creation failed");
    return mapProyecto(rows[0]);
  }

  async listProyectos(): Promise<Proyecto[]> {
    const rows = await databaseService.readAll(
      `SELECT
        id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        createdAt, updatedAt, extrasJson
       FROM Proyecto
       ORDER BY createdAt ASC`,
    );

    return rows.map(mapProyecto);
  }

  /**
   * ✅ Recalcula areal desde pozos (min/max) + margenes
   * y actualiza cellSizeX/Y según Nx/Ny.
   * ✅ NO toca CRS (queda null por ahora).
   */
  async recomputeProyectoArealFromPozos(
    input: RecomputeProyectoArealFromPozosInput,
  ): Promise<Proyecto> {
    const now = new Date().toISOString();

    // 1) bounds de pozos
    const boundsRows = await databaseService.readAll(
      `SELECT
        MIN(x) AS minX,
        MAX(x) AS maxX,
        MIN(y) AS minY,
        MAX(y) AS maxY
       FROM Pozo
       WHERE proyectoId = ?`,
      [input.proyectoId],
    );

    const b = boundsRows[0] as any;
    if (
      !b ||
      b.minX == null ||
      b.maxX == null ||
      b.minY == null ||
      b.maxY == null
    ) {
      throw new Error(
        "No hay pozos en el proyecto para calcular límites areales",
      );
    }

    const minX = Number(b.minX) - input.margenX;
    const maxX = Number(b.maxX) + input.margenX;
    const minY = Number(b.minY) - input.margenY;
    const maxY = Number(b.maxY) + input.margenY;

    if (!(maxX > minX) || !(maxY > minY)) {
      throw new Error("Límites areales inválidos luego de aplicar márgenes");
    }

    // 2) Nx/Ny
    const projRows = await databaseService.readAll(
      `SELECT id, grillaNx, grillaNy
       FROM Proyecto
       WHERE id = ?
       LIMIT 1`,
      [input.proyectoId],
    );
    if (projRows.length === 0) throw new Error("Proyecto no encontrado");

    const grillaNx = Number((projRows[0] as any).grillaNx);
    const grillaNy = Number((projRows[0] as any).grillaNy);

    const cellSizeX = (maxX - minX) / grillaNx;
    const cellSizeY = (maxY - minY) / grillaNy;

    // 3) update
    await databaseService.run(
      `UPDATE Proyecto
       SET
         arealMinX = ?,
         arealMinY = ?,
         arealMaxX = ?,
         arealMaxY = ?,
         grillaCellSizeX = ?,
         grillaCellSizeY = ?,
         updatedAt = ?
       WHERE id = ?`,
      [minX, minY, maxX, maxY, cellSizeX, cellSizeY, now, input.proyectoId],
    );

    const outRows = await databaseService.readAll(
      `SELECT
        id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        createdAt, updatedAt, extrasJson
       FROM Proyecto
       WHERE id = ?
       LIMIT 1`,
      [input.proyectoId],
    );

    if (outRows.length === 0) throw new Error("Proyecto update failed");
    return mapProyecto(outRows[0]);
  }

  // ----------------------------
  // Capa
  // ----------------------------
  async createCapa(input: CreateCapaInput): Promise<Capa> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Capa (id, proyectoId, nombre, createdAt, updatedAt, extrasJson)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.proyectoId, input.nombre, now, now, JSON.stringify({})],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, nombre, createdAt, updatedAt, extrasJson
       FROM Capa
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("Capa creation failed");
    return mapCapa(rows[0]);
  }

  async listCapasByProject(proyectoId: string): Promise<Capa[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, nombre, createdAt, updatedAt, extrasJson
       FROM Capa
       WHERE proyectoId = ?
       ORDER BY createdAt ASC`,
      [proyectoId],
    );

    return rows.map(mapCapa);
  }

  // ----------------------------
  // Pozo
  // ----------------------------
  async createPozo(input: CreatePozoInput): Promise<Pozo> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Pozo (id, proyectoId, nombre, x, y, createdAt, updatedAt, extrasJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.nombre,
        input.x,
        input.y,
        now,
        now,
        JSON.stringify({}),
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, nombre, x, y, createdAt, updatedAt, extrasJson
       FROM Pozo
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("Pozo creation failed");
    return mapPozo(rows[0]);
  }

  async listPozosByProject(proyectoId: string): Promise<Pozo[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, nombre, x, y, createdAt, updatedAt, extrasJson
       FROM Pozo
       WHERE proyectoId = ?
       ORDER BY createdAt ASC`,
      [proyectoId],
    );

    return rows.map(mapPozo);
  }

  // ----------------------------
  // PozoCapa
  // ----------------------------
  async createPozoCapa(input: CreatePozoCapaInput): Promise<PozoCapa> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO PozoCapa (id, proyectoId, pozoId, capaId, tope, base, createdAt, updatedAt, extrasJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.pozoId,
        input.capaId,
        input.tope,
        input.base,
        now,
        now,
        JSON.stringify({}),
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, pozoId, capaId, tope, base, createdAt, updatedAt, extrasJson
       FROM PozoCapa
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("PozoCapa creation failed");
    return mapPozoCapa(rows[0]);
  }

  async listPozoCapaByProject(proyectoId: string): Promise<PozoCapa[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, pozoId, capaId, tope, base, createdAt, updatedAt, extrasJson
       FROM PozoCapa
       WHERE proyectoId = ?
       ORDER BY createdAt ASC`,
      [proyectoId],
    );

    return rows.map(mapPozoCapa);
  }
}
