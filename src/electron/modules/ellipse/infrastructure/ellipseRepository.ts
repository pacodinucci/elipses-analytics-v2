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
  // DuckDB puede devolver listas como arrays JS o como string JSON según driver.
  // Soportamos ambos.
  const parseList = (v: unknown): number[] => {
    if (Array.isArray(v)) return v.map(Number);
    if (typeof v === "string") {
      // puede venir como JSON string
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(Number);
    }
    throw new Error("Invalid list value for x/y in Elipse");
  };

  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
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
    simulacionId: String(row.simulacionId),
    elipseId: String(row.elipseId),
    elipseVariableId: String(row.elipseVariableId),
    valor: Number(row.valor),
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
  // ✅ ELIPSE (geometría)
  // =========================
  async createElipse(input: CreateElipseInput): Promise<Elipse> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Elipse
       (id, proyectoId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
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
      `SELECT id, proyectoId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt
       FROM Elipse WHERE id = ? LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("Elipse creation failed");
    return mapElipse(rows[0]);
  }

  async listElipsesByLayer(capaId: string): Promise<Elipse[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt
       FROM Elipse
       WHERE capaId = ?
       ORDER BY id ASC`,
      [capaId],
    );
    return rows.map(mapElipse);
  }

  async listElipsesByProject(proyectoId: string): Promise<Elipse[]> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, capaId, pozoInyectorId, pozoProductorId, x, y, createdAt, updatedAt
       FROM Elipse
       WHERE proyectoId = ?
       ORDER BY capaId ASC, id ASC`,
      [proyectoId],
    );
    return rows.map(mapElipse);
  }

  // =========================
  // ✅ VALORES
  // =========================
  async createValor(input: CreateElipseValorInput): Promise<ElipseValor> {
    await databaseService.run(
      "INSERT INTO ElipseValor (id, simulacionId, elipseId, elipseVariableId, valor) VALUES (?, ?, ?, ?, ?)",
      [
        input.id,
        input.simulacionId,
        input.elipseId,
        input.elipseVariableId,
        input.valor,
      ],
    );

    const rows = await databaseService.readAll(
      "SELECT id, simulacionId, elipseId, elipseVariableId, valor FROM ElipseValor WHERE id = ? LIMIT 1",
      [input.id],
    );

    if (rows.length === 0) throw new Error("ElipseValor creation failed");
    return mapValor(rows[0]);
  }

  async listValoresBySimulacion(simulacionId: string): Promise<ElipseValor[]> {
    const rows = await databaseService.readAll(
      "SELECT id, simulacionId, elipseId, elipseVariableId, valor FROM ElipseValor WHERE simulacionId = ? ORDER BY id ASC",
      [simulacionId],
    );
    return rows.map(mapValor);
  }

  // =========================
  // ✅ NORMALIZACIÓN (min/max por variable, con universo Elipse ⨝ ElipseValor)
  // =========================
  async elipsesNormalizationAll(args: {
    proyectoId: string;
    scope: "layer_date" | "layer_all" | "field_date" | "field_all";
    capa: string | null; // hoy llega como capaNombre (según tu payload)
    fecha: string | null;
  }): Promise<
    Record<
      string,
      {
        min: number;
        max: number;
      }
    >
  > {
    const { proyectoId, scope, capa, fecha } = args;

    // ⚠️ Nota: hoy payload.capa viene como "capaNombre" (según tu comentario).
    // Si querés que sea por capaId, cambiá el payload y esto se simplifica.
    const whereParts: string[] = ["e.proyectoId = ?"];
    const params: unknown[] = [proyectoId];

    if (scope === "layer_date" || scope === "layer_all") {
      if (!capa)
        throw new Error("capa (capaNombre) is required for layer scope");
      whereParts.push("c.nombre = ?");
      params.push(capa);
    }

    // fecha actualmente NO está en Elipse, y ElipseValor tampoco la tiene.
    // Así que field_date/layer_date solo puede interpretarse vía “simulación activa”
    // o un filtro externo. Por ahora: validamos y seguimos (no filtramos por fecha).
    if ((scope === "layer_date" || scope === "field_date") && fecha) {
      // no-op por diseño actual
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Calcula min/max por elipseVariableId, solo para valores que tengan geometría existente.
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
