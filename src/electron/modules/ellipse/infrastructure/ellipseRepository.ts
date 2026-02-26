import type {
  Elipse,
  ElipseValor,
  ElipseVariable,
} from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateElipseInput,
  CreateElipseValorInput,
  CreateElipseVariableInput,
} from "../domain/ellipse.js";

function mapVariable(row: Record<string, unknown>): ElipseVariable {
  return { id: String(row.id), nombre: String(row.nombre) };
}

function mapElipse(row: Record<string, unknown>): Elipse {
  const parseList = (v: unknown): number[] => {
    if (Array.isArray(v)) return v.map(Number);
    if (typeof v === "string") {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(Number);
    }
    throw new Error("Invalid list value for x/y in Elipse");
  };

  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    simulacionId: row.simulacionId == null ? null : String(row.simulacionId),
    capaId: String(row.capaId),
    pozoInyectorId:
      row.pozoInyectorId == null ? null : String(row.pozoInyectorId),
    pozoProductorId:
      row.pozoProductorId == null ? null : String(row.pozoProductorId),
    x: parseList(row.x),
    y: parseList(row.y),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapValor(row: Record<string, unknown>): ElipseValor {
  return {
    id: String(row.id),
    elipseId: String(row.elipseId),
    elipseVariableId: String(row.elipseVariableId),
    valor: Number(row.valor),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class EllipseRepository {
  // =========================
  // ✅ VARIABLES
  // =========================
  async createVariable(
    input: CreateElipseVariableInput,
  ): Promise<ElipseVariable> {
    await databaseService.run(
      "INSERT INTO ElipseVariable (id, nombre) VALUES (?, ?)",
      [input.id, input.nombre],
    );

    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM ElipseVariable WHERE id = ? LIMIT 1",
      [input.id],
    );

    if (rows.length === 0) throw new Error("ElipseVariable creation failed");
    return mapVariable(rows[0]);
  }

  async listVariables(): Promise<ElipseVariable[]> {
    const rows = await databaseService.readAll(
      "SELECT id, nombre FROM ElipseVariable ORDER BY nombre ASC",
    );
    return rows.map(mapVariable);
  }

  // =========================
  // ✅ ELIPSE (geometría por simulación)
  // =========================
  async createElipse(input: CreateElipseInput): Promise<Elipse> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Elipse
       (id, proyectoId, simulacionId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.simulacionId,
        input.capaId,
        input.pozoInyectorId ?? null,
        input.pozoProductorId ?? null,
        input.x,
        input.y,
        now,
        now,
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, simulacionId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt
       FROM Elipse WHERE id = ? LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("Elipse creation failed");
    return mapElipse(rows[0]);
  }

  async listElipsesByLayer(
    simulacionId: string,
    capaId: string,
  ): Promise<Elipse[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, simulacionId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt
       FROM Elipse
       WHERE simulacionId = ? AND capaId = ?
       ORDER BY id ASC`,
      [simulacionId, capaId],
    );
    return rows.map(mapElipse);
  }

  async listElipsesByProject(proyectoId: string): Promise<Elipse[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, simulacionId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt
       FROM Elipse
       WHERE proyectoId = ?
       ORDER BY capaId ASC, id ASC`,
      [proyectoId],
    );
    return rows.map(mapElipse);
  }

  // =========================
  // ✅ VALORES (depende de Elipse)
  // =========================
  async createValor(input: CreateElipseValorInput): Promise<ElipseValor> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO ElipseValor (id, elipseId, elipseVariableId, valor, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.elipseId, input.elipseVariableId, input.valor, now, now],
    );

    const rows = await databaseService.readAll(
      `SELECT id, elipseId, elipseVariableId, valor, createdAt, updatedAt
       FROM ElipseValor WHERE id = ? LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("ElipseValor creation failed");
    return mapValor(rows[0]);
  }

  /**
   * Compat: mantenemos "listBySimulacion" pero ahora es JOIN con Elipse
   */
  async listValoresBySimulacion(simulacionId: string): Promise<ElipseValor[]> {
    const rows = await databaseService.readAll(
      `
      SELECT ev.id, ev.elipseId, ev.elipseVariableId, ev.valor, ev.createdAt, ev.updatedAt
      FROM ElipseValor ev
      JOIN Elipse e ON e.id = ev.elipseId
      WHERE e.simulacionId = ?
      ORDER BY ev.id ASC
      `,
      [simulacionId],
    );
    return rows.map(mapValor);
  }

  // =========================
  // ✅ NORMALIZACIÓN (min/max por variable)
  // =========================
  async elipsesNormalizationAll(args: {
    proyectoId: string;
    scope: "layer_date" | "layer_all" | "field_date" | "field_all";
    capa: string | null; // capaNombre
    fecha: string | null;
    simulacionId?: string | null;
  }): Promise<Record<string, { min: number; max: number }>> {
    const { proyectoId, scope, capa, fecha, simulacionId } = args;

    const whereParts: string[] = ["e.proyectoId = ?"];
    const params: unknown[] = [proyectoId];

    // ✅ si te pasan simulacionId, filtramos universo por simulación
    if (simulacionId) {
      whereParts.push("e.simulacionId = ?");
      params.push(simulacionId);
    }

    if (scope === "layer_date" || scope === "layer_all") {
      if (!capa)
        throw new Error("capa (capaNombre) is required for layer scope");
      whereParts.push("c.nombre = ?");
      params.push(capa);
    }

    // fecha sigue siendo no-aplicable al modelo de elipses (no hay fecha en elipse/valor).
    if ((scope === "layer_date" || scope === "field_date") && fecha) {
      // no-op (documentado)
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const rows = await databaseService.readAll(
      `
      SELECT
        ev.elipseVariableId AS elipseVariableId,
        MIN(ev.valor) AS minVal,
        MAX(ev.valor) AS maxVal
      FROM ElipseValor ev
      JOIN Elipse e ON e.id = ev.elipseId
      JOIN Capa c ON c.id = e.capaId
      ${where}
      GROUP BY ev.elipseVariableId
      `,
      params,
    );

    const out: Record<string, { min: number; max: number }> = {};
    for (const r of rows) {
      const id = String(r.elipseVariableId);
      const min = Number(r.minVal);
      const max = Number(r.maxVal);
      if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
      out[id] = { min, max };
    }
    return out;
  }
}
