// src/electron/modules/variables/infrastructure/variablesRepository.ts
import crypto from "node:crypto";

import type {
  GrupoVariable,
  Variable,
  Unidades,
} from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type {
  CreateGrupoVariableInput,
  CreateVariableInput,
  UpsertUnidadInput,
} from "../domain/variables.js";

function safeJson(value: unknown, fallback: unknown = {}) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function mapGrupo(row: Record<string, unknown>): GrupoVariable {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    nombre: String(row.nombre),
    orden: Number(row.orden),
    scope: String(row.scope ?? "PROYECTO") as GrupoVariable["scope"],
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    extrasJson: safeJson(row.extrasJson, {}) as any,
  };
}

function mapVariable(row: Record<string, unknown>): Variable {
  return {
    id: String(row.id),
    grupoVariableId: String(row.grupoVariableId),
    nombre: String(row.nombre),
    codigo: String(row.codigo),
    tipoDato: String(row.tipoDato),
    configJson: safeJson(row.configJson, {}),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    extrasJson: safeJson(row.extrasJson, {}) as any,
  };
}

function mapUnidades(row: Record<string, unknown>): Unidades {
  return {
    id: String(row.id),
    proyectoId: String(row.proyectoId),
    unidad: String(row.unidad),
    configJson: safeJson(row.configJson, {}),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    extrasJson: safeJson(row.extrasJson, {}) as any,
  };
}

export class VariablesRepository {
  // ----------------------------
  // GrupoVariable
  // ----------------------------
  async createGrupoVariable(
    input: CreateGrupoVariableInput,
  ): Promise<GrupoVariable> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO GrupoVariable (
        id, proyectoId, nombre, orden, scope, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proyectoId,
        input.nombre,
        input.orden,
        input.scope ?? "PROYECTO",
        now,
        now,
        JSON.stringify(input.extrasJson ?? {}),
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, nombre, orden, scope, createdAt, updatedAt, extrasJson
       FROM GrupoVariable
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("GrupoVariable creation failed");
    return mapGrupo(rows[0]);
  }

  async listGrupoVariable(proyectoId?: string): Promise<GrupoVariable[]> {
    const rows = proyectoId
      ? await databaseService.readAll(
          `SELECT id, proyectoId, nombre, orden, scope, createdAt, updatedAt, extrasJson
           FROM GrupoVariable
           WHERE proyectoId = ?
           ORDER BY orden ASC, nombre ASC`,
          [proyectoId],
        )
      : await databaseService.readAll(
          `SELECT id, proyectoId, nombre, orden, scope, createdAt, updatedAt, extrasJson
           FROM GrupoVariable
           ORDER BY orden ASC, nombre ASC`,
        );
    return rows.map(mapGrupo);
  }

  // ----------------------------
  // Variable
  // ----------------------------
  async createVariable(input: CreateVariableInput): Promise<Variable> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Variable (
        id, grupoVariableId, nombre, codigo, tipoDato,
        configJson, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.grupoVariableId,
        input.nombre,
        input.codigo,
        input.tipoDato,
        JSON.stringify(input.configJson ?? {}),
        now,
        now,
        JSON.stringify(input.extrasJson ?? {}),
      ],
    );

    const rows = await databaseService.readAll(
      `SELECT
         id, grupoVariableId, nombre, codigo, tipoDato,
         configJson, createdAt, updatedAt, extrasJson
       FROM Variable
       WHERE id = ?
       LIMIT 1`,
      [input.id],
    );

    if (rows.length === 0) throw new Error("Variable creation failed");
    return mapVariable(rows[0]);
  }

  async listVariableByGrupoVariable(
    grupoVariableId: string,
  ): Promise<Variable[]> {
    const rows = await databaseService.readAll(
      `SELECT
         id, grupoVariableId, nombre, codigo, tipoDato,
         configJson, createdAt, updatedAt, extrasJson
       FROM Variable
       WHERE grupoVariableId = ?
       ORDER BY createdAt ASC`,
      [grupoVariableId],
    );
    return rows.map(mapVariable);
  }

  // ----------------------------
  // ✅ Unidades (settings por proyecto+variable)
  // ----------------------------
  async listUnidadesByProyecto(proyectoId: string): Promise<Unidades[]> {
    const rows = await databaseService.readAll(
      `SELECT
         id, proyectoId, unidad,
         configJson, createdAt, updatedAt, extrasJson
       FROM Unidades
       WHERE proyectoId = ?
       ORDER BY unidad ASC`,
      [proyectoId],
    );
    return rows.map(mapUnidades);
  }

  async upsertUnidad(input: UpsertUnidadInput): Promise<{ id: string }> {
    const now = new Date().toISOString();

    const existing = input.id
      ? await databaseService.readAll(
          `SELECT id
           FROM Unidades
           WHERE id = ?
           LIMIT 1`,
          [input.id],
        )
      : await databaseService.readAll(
          `SELECT id
           FROM Unidades
           WHERE proyectoId = ? AND unidad = ?
           LIMIT 1`,
          [input.proyectoId, input.unidad],
        );

    const row = existing[0] as { id?: string } | undefined;

    if (row?.id) {
      await databaseService.run(
        `UPDATE Unidades
         SET unidad = ?, configJson = ?, updatedAt = ?, extrasJson = ?
         WHERE id = ?`,
        [
          input.unidad,
          JSON.stringify(input.configJson ?? {}),
          now,
          JSON.stringify(input.extrasJson ?? {}),
          row.id,
        ],
      );
      return { id: row.id };
    }

    const id = crypto.randomUUID();
    await databaseService.run(
      `INSERT INTO Unidades (
        id, proyectoId, unidad,
        configJson, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.proyectoId,
        input.unidad,
        JSON.stringify(input.configJson ?? {}),
        now,
        now,
        JSON.stringify(input.extrasJson ?? {}),
      ],
    );

    return { id };
  }
}
