// src/electron/modules/dynamic-fields/application/service.ts
import { randomUUID } from "node:crypto";
import { databaseService } from "../../../shared/db/index.js";

export type DynamicEntity =
  | "Proyecto"
  | "Unidades"
  | "GrupoVariable"
  | "Variable"
  | "Capa"
  | "Pozo"
  | "PozoCapa"
  | "TipoEscenario"
  | "Escenario"
  | "ValorEscenario"
  | "TipoSimulacion"
  | "Simulacion"
  | "TipoEstadoPozo"
  | "SetEstadoPozos"
  | "SetEstadoPozosDetalle"
  | "VariableMapa"
  | "Mapa"
  | "ElipseVariable"
  | "Elipse"
  | "ElipseValor"
  | "import_jobs"
  | "import_job_errors";

export type DynamicFieldDataType =
  | "number"
  | "string"
  | "boolean"
  | "date"
  | "enum"
  | "json";

export type DynamicFieldDefRow = {
  id: string;
  entity: DynamicEntity;
  key: string;
  dataType: DynamicFieldDataType;
  label: string | null;
  unit: string | null;
  configJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const ENTITY_TABLES: Record<DynamicEntity, string> = {
  Proyecto: "Proyecto",
  Unidades: "Unidades",
  GrupoVariable: "GrupoVariable",
  Variable: "Variable",
  Capa: "Capa",
  Pozo: "Pozo",
  PozoCapa: "PozoCapa",

  TipoEscenario: "TipoEscenario",
  Escenario: "Escenario",
  ValorEscenario: "ValorEscenario",

  TipoSimulacion: "TipoSimulacion",
  Simulacion: "Simulacion",
  TipoEstadoPozo: "TipoEstadoPozo",
  SetEstadoPozos: "SetEstadoPozos",
  SetEstadoPozosDetalle: "SetEstadoPozosDetalle",
  VariableMapa: "VariableMapa",
  Mapa: "Mapa",

  ElipseVariable: "ElipseVariable",
  Elipse: "Elipse",
  ElipseValor: "ElipseValor",

  import_jobs: "import_jobs",
  import_job_errors: "import_job_errors",
};

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === "object") return v as Record<string, unknown>; // duckdb JSON a veces viene como objeto
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function mergePatch(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
  unsetKeys?: string[],
) {
  const next: Record<string, unknown> = { ...prev, ...patch };
  if (Array.isArray(unsetKeys)) {
    for (const k of unsetKeys) delete next[k];
  }
  return next;
}

export async function listDefs(
  entity: DynamicEntity,
): Promise<DynamicFieldDefRow[]> {
  const rows = await databaseService.readAll(
    `SELECT id, entity, key, dataType, label, unit, configJson, createdAt, updatedAt
     FROM DynamicFieldDef
     WHERE entity = ?
     ORDER BY key`,
    [entity],
  );

  return rows.map((r) => ({
    id: String(r.id),
    entity: r.entity as DynamicEntity,
    key: String(r.key),
    dataType: r.dataType as DynamicFieldDataType,
    label: r.label == null ? null : String(r.label),
    unit: r.unit == null ? null : String(r.unit),
    configJson: safeJsonParse(r.configJson),
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
  }));
}

export async function createDef(input: {
  entity: DynamicEntity;
  key: string;
  dataType: DynamicFieldDataType;
  label?: string | null;
  unit?: string | null;
  configJson?: Record<string, unknown> | null;
}): Promise<DynamicFieldDefRow> {
  const entity = input.entity;
  const key = String(input.key || "").trim();

  if (!key) throw new Error("DynamicFieldDef.key requerido");
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    throw new Error(
      "DynamicFieldDef.key inválido. Usá snake_case: letras, números y '_' (no empezar con número).",
    );
  }

  const id = randomUUID();
  const ts = nowIso();
  const configJson = input.configJson ?? {};

  await databaseService.run(
    `INSERT INTO DynamicFieldDef
     (id, entity, key, dataType, label, unit, configJson, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entity,
      key,
      input.dataType,
      input.label ?? null,
      input.unit ?? null,
      JSON.stringify(configJson),
      ts,
      ts,
    ],
  );

  const rows = await databaseService.readAll(
    `SELECT id, entity, key, dataType, label, unit, configJson, createdAt, updatedAt
     FROM DynamicFieldDef WHERE id = ?`,
    [id],
  );

  const row = rows[0];
  if (!row) throw new Error("No se pudo leer DynamicFieldDef recién creado");

  return {
    id: String(row.id),
    entity: row.entity as DynamicEntity,
    key: String(row.key),
    dataType: row.dataType as DynamicFieldDataType,
    label: row.label == null ? null : String(row.label),
    unit: row.unit == null ? null : String(row.unit),
    configJson: safeJsonParse(row.configJson),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export async function updateEntityExtras(input: {
  entity: DynamicEntity;
  entityId: string;
  patch: Record<string, unknown>;
  unsetKeys?: string[];
}): Promise<{
  entity: DynamicEntity;
  entityId: string;
  extrasJson: Record<string, unknown>;
}> {
  const table = ENTITY_TABLES[input.entity];
  if (!table) throw new Error(`Entidad no permitida: ${input.entity}`);

  const entityId = String(input.entityId || "").trim();
  if (!entityId) throw new Error("entityId requerido");

  // Leer extrasJson actual
  const rows = await databaseService.readAll(
    `SELECT extrasJson FROM ${table} WHERE id = ?`,
    [entityId],
  );

  if (!rows.length) {
    throw new Error(`No existe ${input.entity} con id=${entityId}`);
  }

  const prev = safeJsonParse(rows[0]?.extrasJson);
  const next = mergePatch(prev, input.patch ?? {}, input.unsetKeys);

  // Guardar (DuckDB JSON acepta string JSON; queda OK)
  await databaseService.run(`UPDATE ${table} SET extrasJson = ? WHERE id = ?`, [
    JSON.stringify(next),
    entityId,
  ]);

  return {
    entity: input.entity,
    entityId,
    extrasJson: next,
  };
}
