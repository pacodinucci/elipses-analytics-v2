import { randomUUID } from "node:crypto";
import { migrations } from "../../../shared/db/migrations.js";
import { databaseService } from "../../../shared/db/index.js";
import { coreDataService } from "../../core-data/application/coreDataService.js";
import { mapService } from "../../maps/application/mapService.js";
import { scenarioService } from "../../scenarios/application/scenarioService.js";
import { scenarioValueService } from "../../scenario-values/application/scenarioValueService.js";

import type {
  CapaTxtImportPayload,
  ImportJobError,
  ImportJobResult,
  ImportJobSummary,
  MapImportPayload,
  MapImportRow,
  PozoTxtImportPayload,
  ScenarioTxtImportPayload,
} from "../domain/importJob.js";

import {
  validateCapaTxtImportPayload,
  validateMapImportPayload,
  validatePozoTxtImportPayload,
  validateScenarioTxtImportPayload,
} from "../domain/importJob.js";

import { ImportJobRepository } from "../infrastructure/importJobRepository.js";

function emptySummary(totalRows: number): ImportJobSummary {
  return {
    totalRows,
    acceptedRows: 0,
    rejectedRows: 0,
    warnings: 0,
    errors: 0,
  };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNullableNumber(raw: string | undefined): number | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function normalizeScenarioHeader(raw: string): string {
  const key = raw.trim().toLowerCase();

  if (["pozo", "well"].includes(key)) return "pozo";
  if (["capa", "layer"].includes(key)) return "capa";
  if (["fecha", "date"].includes(key)) return "fecha";
  if (["petroleo", "oil"].includes(key)) return "petroleo";
  if (["agua", "water"].includes(key)) return "agua";
  if (["gas"].includes(key)) return "gas";
  if (
    ["inyeccionagua", "agua_iny", "agua_inyectada", "inyeccion_agua"].includes(
      key,
    )
  ) {
    return "inyeccionAgua";
  }
  if (["inyecciongas", "gas_iny", "inyeccion_gas"].includes(key)) {
    return "inyeccionGas";
  }

  return key;
}

type ParsedScenarioRow = {
  rowNumber: number;
  pozo: string;
  capa: string | null;
  fecha: string;
  petroleo: number | null;
  agua: number | null;
  gas: number | null;
  inyeccionGas: number | null;
  inyeccionAgua: number | null;
};

type ResolvedScenarioRow = {
  rowNumber: number;
  pozoId: string;
  capaId: string | null;
  fecha: string;
  petroleo: number | null;
  agua: number | null;
  gas: number | null;
  inyeccionGas: number | null;
  inyeccionAgua: number | null;
};

function parseScenarioTxtContent(content: string): ParsedScenarioRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headerTokens = lines[0].split(/\s+/).map(normalizeScenarioHeader);
  const rows: ParsedScenarioRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const values = lines[i].split(/\s+/);

    const data: Record<string, string> = {};
    for (let j = 0; j < headerTokens.length; j += 1) {
      data[headerTokens[j]] = values[j] ?? "";
    }

    rows.push({
      rowNumber,
      pozo: (data.pozo ?? "").trim(),
      capa: (data.capa ?? "").trim() || null,
      fecha: (data.fecha ?? "").trim(),
      petroleo: parseNullableNumber(data.petroleo),
      agua: parseNullableNumber(data.agua),
      gas: parseNullableNumber(data.gas),
      inyeccionGas: parseNullableNumber(data.inyeccionGas),
      inyeccionAgua: parseNullableNumber(data.inyeccionAgua),
    });
  }

  return rows;
}

function hasAnyMetric(row: ParsedScenarioRow): boolean {
  return (
    row.petroleo != null ||
    row.agua != null ||
    row.gas != null ||
    row.inyeccionGas != null ||
    row.inyeccionAgua != null
  );
}

function validateScenarioRowByType(
  row: ParsedScenarioRow,
  tipoEscenarioId: string,
): ImportJobError[] {
  const errors: ImportJobError[] = [];

  if (!row.pozo) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "pozo",
      severity: "error",
      message: "pozo is required",
    });
  }

  if (!row.fecha) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "fecha",
      severity: "error",
      message: "fecha is required",
    });
  } else if (!isValidISODate(row.fecha)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "fecha",
      severity: "error",
      message: "fecha must be YYYY-MM-DD",
    });
  }

  if (!hasAnyMetric(row)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "metrics",
      severity: "error",
      message: "at least one metric is required",
    });
  }

  if (tipoEscenarioId === "historia") {
    if (row.capa) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "capa",
        severity: "error",
        message: 'tipo "historia" no admite capa',
      });
    }
  }

  if (tipoEscenarioId === "datos") {
    if (!row.capa) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "capa",
        severity: "error",
        message: 'tipo "datos" requiere capa',
      });
    }
  }

  return errors;
}

function buildScenarioLogicalKey(
  tipoEscenarioId: string,
  pozoId: string,
  fecha: string,
  capaId: string | null,
): string {
  if (tipoEscenarioId === "historia") {
    return `${pozoId}::__NO_CAPA__::${fecha}`;
  }
  return `${pozoId}::${capaId ?? "__NO_CAPA__"}::${fecha}`;
}

// =========================
// Map import helpers
// =========================
function validateMapRow(
  row: MapImportRow,
  rowNumber: number,
): ImportJobError[] {
  const errors: ImportJobError[] = [];

  if (!row.id) {
    errors.push({
      rowNumber,
      field: "id",
      severity: "error",
      message: "id is required",
    });
  }
  if (!row.proyectoId) {
    errors.push({
      rowNumber,
      field: "proyectoId",
      severity: "error",
      message: "proyectoId is required",
    });
  }
  if (!row.capaId) {
    errors.push({
      rowNumber,
      field: "capaId",
      severity: "error",
      message: "capaId is required",
    });
  }
  if (!row.grupoVariableId) {
    errors.push({
      rowNumber,
      field: "grupoVariableId",
      severity: "error",
      message: "grupoVariableId is required",
    });
  }

  if (!Array.isArray(row.xedges)) {
    errors.push({
      rowNumber,
      field: "xedges",
      severity: "error",
      message: "xedges must be an array",
    });
  }
  if (!Array.isArray(row.yedges)) {
    errors.push({
      rowNumber,
      field: "yedges",
      severity: "error",
      message: "yedges must be an array",
    });
  }
  if (!Array.isArray(row.grid)) {
    errors.push({
      rowNumber,
      field: "grid",
      severity: "error",
      message: "grid must be an array",
    });
  }

  return errors;
}

interface ParsedLayerRow {
  rowNumber: number;
  nombre: string;
}

function parseLayerTxtContent(content: string): ParsedLayerRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  return lines
    .map((line, index) => ({ line, rowNumber: index + 1 }))
    .filter(
      ({ line, rowNumber }) =>
        !(rowNumber === 1 && line.toLowerCase() === "capa"),
    )
    .map(({ line, rowNumber }) => ({ rowNumber, nombre: line }));
}

type ParsedPozoRow = {
  rowNumber: number;
  nombre: string;
  x: number;
  y: number;
};

function toNumberFlexible(value: string): number {
  const normalized = value.replace(",", ".").trim();
  return Number(normalized);
}

function parsePozosTxtContent(content: string): ParsedPozoRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  let startIndex = 0;
  const firstTokens = lines[0].split(/\s+/).map((t) => t.trim().toLowerCase());
  if (
    firstTokens.length >= 3 &&
    (firstTokens[0] === "pozo" || firstTokens[0] === "nombre") &&
    firstTokens[1] === "x" &&
    firstTokens[2] === "y"
  ) {
    startIndex = 1;
  }

  const out: ParsedPozoRow[] = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const tokens = lines[i].split(/\s+/).filter(Boolean);

    const nombre = (tokens[0] ?? "").trim();
    const xRaw = (tokens[1] ?? "").trim();
    const yRaw = (tokens[2] ?? "").trim();

    const x = xRaw ? toNumberFlexible(xRaw) : Number.NaN;
    const y = yRaw ? toNumberFlexible(yRaw) : Number.NaN;

    out.push({ rowNumber, nombre, x, y });
  }

  return out;
}

function validatePozoRow(row: ParsedPozoRow): ImportJobError[] {
  const errors: ImportJobError[] = [];

  if (!row.nombre) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "pozo",
      severity: "error",
      message: "pozo (nombre) is required",
    });
  }
  if (!Number.isFinite(row.x)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "x",
      severity: "error",
      message: "x must be a number",
    });
  }
  if (!Number.isFinite(row.y)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "y",
      severity: "error",
      message: "y must be a number",
    });
  }

  return errors;
}

export class ImportService {
  private readonly repository = new ImportJobRepository();
  private schemaReady = false;

  async dryRunMapImport(payload: MapImportPayload): Promise<ImportJobResult> {
    validateMapImportPayload(payload);
    await this.ensureSchema();

    const summary = emptySummary(payload.rows.length);
    const errors: ImportJobError[] = [];

    payload.rows.forEach((row, index) => {
      const rowErrors = validateMapRow(row, index + 1);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        summary.rejectedRows += 1;
        return;
      }
      summary.acceptedRows += 1;
    });

    summary.errors = errors.length;
    const status = errors.length > 0 ? "failed" : "completed";
    const jobId = await this.repository.createJob("Mapa", "dry-run", summary);

    if (errors.length > 0) await this.repository.addErrors(jobId, errors);
    await this.repository.completeJob(jobId, status, summary);

    return { jobId, entity: "Mapa", mode: "dry-run", status, summary, errors };
  }

  async commitMapImport(payload: MapImportPayload): Promise<ImportJobResult> {
    validateMapImportPayload(payload);
    await this.ensureSchema();

    const dryRun = await this.dryRunMapImport(payload);
    if (dryRun.errors.length > 0) {
      return { ...dryRun, mode: "commit", status: "failed" };
    }

    const summary = emptySummary(payload.rows.length);
    const errors: ImportJobError[] = [];
    const jobId = await this.repository.createJob("Mapa", "commit", summary);

    for (let i = 0; i < payload.rows.length; i += 1) {
      const row = payload.rows[i];
      try {
        await mapService.upsertMap(row);
        summary.acceptedRows += 1;
      } catch (error) {
        summary.rejectedRows += 1;
        errors.push({
          rowNumber: i + 1,
          severity: "error",
          message:
            error instanceof Error ? error.message : "Unknown map import error",
        });
      }
    }

    summary.errors = errors.length;
    const status = errors.length > 0 ? "failed" : "completed";
    if (errors.length > 0) await this.repository.addErrors(jobId, errors);
    await this.repository.completeJob(jobId, status, summary);

    return { jobId, entity: "Mapa", mode: "commit", status, summary, errors };
  }

  async dryRunCapaTxtImport(
    payload: CapaTxtImportPayload,
  ): Promise<ImportJobResult> {
    validateCapaTxtImportPayload(payload);
    await this.ensureSchema();

    const parsedRows = parseLayerTxtContent(payload.content);
    const summary = emptySummary(parsedRows.length);
    const errors: ImportJobError[] = [];

    if (parsedRows.length === 0) {
      errors.push({
        rowNumber: 1,
        field: "content",
        severity: "error",
        message: "TXT does not contain layer rows",
      });
    }

    const seen = new Set<string>();

    parsedRows.forEach((row) => {
      const normalized = row.nombre.toLowerCase();

      if (!row.nombre) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "nombre",
          severity: "error",
          message: "nombre is required",
        });
        summary.rejectedRows += 1;
        return;
      }

      if (seen.has(normalized)) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "nombre",
          severity: "error",
          message: "duplicated layer name",
        });
        summary.rejectedRows += 1;
        return;
      }

      seen.add(normalized);
      summary.acceptedRows += 1;
    });

    summary.errors = errors.length;
    const status = errors.length > 0 ? "failed" : "completed";
    const jobId = await this.repository.createJob("Capa", "dry-run", summary);

    if (errors.length > 0) await this.repository.addErrors(jobId, errors);
    await this.repository.completeJob(jobId, status, summary);

    return { jobId, entity: "Capa", mode: "dry-run", status, summary, errors };
  }

  async commitCapaTxtImport(
    payload: CapaTxtImportPayload,
  ): Promise<ImportJobResult> {
    validateCapaTxtImportPayload(payload);
    await this.ensureSchema();

    const dryRun = await this.dryRunCapaTxtImport(payload);
    if (dryRun.errors.length > 0) {
      return { ...dryRun, mode: "commit", status: "failed" };
    }

    const parsedRows = parseLayerTxtContent(payload.content);
    const summary = emptySummary(parsedRows.length);
    const errors: ImportJobError[] = [];
    const seen = new Set<string>();
    const jobId = await this.repository.createJob("Capa", "commit", summary);

    for (const row of parsedRows) {
      const normalized = row.nombre.toLowerCase();
      if (seen.has(normalized)) {
        summary.rejectedRows += 1;
        continue;
      }
      seen.add(normalized);

      try {
        await coreDataService.createCapa({
          id: randomUUID(),
          proyectoId: payload.proyectoId,
          nombre: row.nombre,
        });
        summary.acceptedRows += 1;
      } catch (error) {
        summary.rejectedRows += 1;
        errors.push({
          rowNumber: row.rowNumber,
          field: "nombre",
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unknown layer import error",
        });
      }
    }

    summary.errors = errors.length;
    const status = errors.length > 0 ? "failed" : "completed";
    if (errors.length > 0) await this.repository.addErrors(jobId, errors);
    await this.repository.completeJob(jobId, status, summary);

    return { jobId, entity: "Capa", mode: "commit", status, summary, errors };
  }

  async dryRunPozoTxtImport(
    payload: PozoTxtImportPayload,
  ): Promise<ImportJobResult> {
    validatePozoTxtImportPayload(payload);
    await this.ensureSchema();

    const parsed = parsePozosTxtContent(payload.content);
    const summary = emptySummary(parsed.length);
    const errors: ImportJobError[] = [];

    if (parsed.length === 0) {
      errors.push({
        rowNumber: 1,
        field: "content",
        severity: "error",
        message: "TXT does not contain well rows (expected columns: pozo x y)",
      });

      summary.errors = errors.length;
      const jobId = await this.repository.createJob("Pozo", "dry-run", summary);
      await this.repository.addErrors(jobId, errors);
      await this.repository.completeJob(jobId, "failed", summary);

      return {
        jobId,
        entity: "Pozo",
        mode: "dry-run",
        status: "failed",
        summary,
        errors,
      };
    }

    const seen = new Set<string>();

    for (const row of parsed) {
      const rowErrors = validatePozoRow(row);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        summary.rejectedRows += 1;
        continue;
      }

      const key = row.nombre.toLowerCase();
      if (seen.has(key)) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "pozo",
          severity: "error",
          message: "duplicated well name",
        });
        summary.rejectedRows += 1;
        continue;
      }

      seen.add(key);
      summary.acceptedRows += 1;
    }

    summary.errors = errors.length;
    const status = errors.length > 0 ? "failed" : "completed";
    const jobId = await this.repository.createJob("Pozo", "dry-run", summary);

    if (errors.length > 0) await this.repository.addErrors(jobId, errors);
    await this.repository.completeJob(jobId, status, summary);

    return { jobId, entity: "Pozo", mode: "dry-run", status, summary, errors };
  }

  async commitPozoTxtImport(
    payload: PozoTxtImportPayload,
  ): Promise<ImportJobResult> {
    validatePozoTxtImportPayload(payload);
    await this.ensureSchema();

    const dryRun = await this.dryRunPozoTxtImport(payload);
    if (dryRun.errors.length > 0) {
      return { ...dryRun, mode: "commit", status: "failed" };
    }

    const parsed = parsePozosTxtContent(payload.content);

    const summary = emptySummary(parsed.length);
    const errors: ImportJobError[] = [];
    const jobId = await this.repository.createJob("Pozo", "commit", summary);

    const seen = new Set<string>();

    for (const row of parsed) {
      const key = row.nombre.toLowerCase();

      const rowErrors = validatePozoRow(row);
      if (rowErrors.length > 0) {
        summary.rejectedRows += 1;
        errors.push(...rowErrors);
        continue;
      }

      if (seen.has(key)) {
        summary.rejectedRows += 1;
        errors.push({
          rowNumber: row.rowNumber,
          field: "pozo",
          severity: "error",
          message: "duplicated well name",
        });
        continue;
      }
      seen.add(key);

      try {
        await coreDataService.createPozo({
          id: randomUUID(),
          proyectoId: payload.proyectoId,
          nombre: row.nombre,
          x: row.x,
          y: row.y,
        });
        summary.acceptedRows += 1;
      } catch (error) {
        summary.rejectedRows += 1;
        errors.push({
          rowNumber: row.rowNumber,
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unknown well import error",
        });
      }
    }

    summary.errors = errors.length;
    const status = errors.length > 0 ? "failed" : "completed";
    if (errors.length > 0) await this.repository.addErrors(jobId, errors);
    await this.repository.completeJob(jobId, status, summary);

    return { jobId, entity: "Pozo", mode: "commit", status, summary, errors };
  }

  async dryRunScenarioTxtImport(
    payload: ScenarioTxtImportPayload,
  ): Promise<ImportJobResult> {
    validateScenarioTxtImportPayload(payload);
    await this.ensureSchema();

    const { summary, errors } = await this.prepareScenarioImport(payload);
    const status = errors.length > 0 ? "failed" : "completed";
    const jobId = await this.repository.createJob(
      "Escenario",
      "dry-run",
      summary,
    );

    if (errors.length > 0) {
      await this.repository.addErrors(jobId, errors);
    }
    await this.repository.completeJob(jobId, status, summary);

    return {
      jobId,
      entity: "Escenario",
      mode: "dry-run",
      status,
      summary,
      errors,
    };
  }

  async commitScenarioTxtImport(
    payload: ScenarioTxtImportPayload,
  ): Promise<ImportJobResult> {
    validateScenarioTxtImportPayload(payload);
    await this.ensureSchema();

    const prepared = await this.prepareScenarioImport(payload);
    if (prepared.errors.length > 0) {
      const jobId = await this.repository.createJob(
        "Escenario",
        "commit",
        prepared.summary,
      );
      await this.repository.addErrors(jobId, prepared.errors);
      await this.repository.completeJob(jobId, "failed", prepared.summary);

      return {
        jobId,
        entity: "Escenario",
        mode: "commit",
        status: "failed",
        summary: prepared.summary,
        errors: prepared.errors,
      };
    }

    const summary = emptySummary(prepared.rows.length);
    const errors: ImportJobError[] = [];
    const jobId = await this.repository.createJob(
      "Escenario",
      "commit",
      summary,
    );

    const escenario = await scenarioService.createEscenario({
      id: randomUUID(),
      proyectoId: payload.proyectoId,
      tipoEscenarioId: payload.tipoEscenarioId,
      nombre: payload.nombreEscenario,
    });

    for (const row of prepared.rows) {
      try {
        await scenarioValueService.upsert({
          id: randomUUID(),
          escenarioId: escenario.id,
          pozoId: row.pozoId,
          capaId: row.capaId,
          fecha: row.fecha,
          petroleo: row.petroleo,
          agua: row.agua,
          gas: row.gas,
          inyeccionGas: row.inyeccionGas,
          inyeccionAgua: row.inyeccionAgua,
        });

        summary.acceptedRows += 1;
      } catch (error) {
        summary.rejectedRows += 1;
        errors.push({
          rowNumber: row.rowNumber,
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unknown scenario import error",
        });
      }
    }

    summary.totalRows = prepared.rows.length;
    summary.errors = errors.length;

    const status = errors.length > 0 ? "failed" : "completed";
    if (errors.length > 0) {
      await this.repository.addErrors(jobId, errors);
    }
    await this.repository.completeJob(jobId, status, summary);

    return {
      jobId,
      entity: "Escenario",
      mode: "commit",
      status,
      summary,
      errors,
    };
  }

  private async prepareScenarioImport(
    payload: ScenarioTxtImportPayload,
  ): Promise<{
    rows: ResolvedScenarioRow[];
    summary: ImportJobSummary;
    errors: ImportJobError[];
  }> {
    const parsedRows = parseScenarioTxtContent(payload.content);
    const summary = emptySummary(parsedRows.length);
    const errors: ImportJobError[] = [];

    const tipo = await databaseService.readAll(
      `SELECT id, nombre FROM TipoEscenario WHERE id = ? LIMIT 1`,
      [payload.tipoEscenarioId],
    );

    if (tipo.length === 0) {
      errors.push({
        rowNumber: 1,
        field: "tipoEscenarioId",
        severity: "error",
        message: `TipoEscenario no existe: ${payload.tipoEscenarioId}`,
      });

      summary.errors = errors.length;
      return { rows: [], summary, errors };
    }

    if (
      payload.tipoEscenarioId !== "historia" &&
      payload.tipoEscenarioId !== "datos"
    ) {
      errors.push({
        rowNumber: 1,
        field: "tipoEscenarioId",
        severity: "error",
        message: `Importación no soportada aún para tipo "${payload.tipoEscenarioId}"`,
      });

      summary.errors = errors.length;
      return { rows: [], summary, errors };
    }

    if (parsedRows.length === 0) {
      errors.push({
        rowNumber: 1,
        field: "content",
        severity: "error",
        message: "TXT does not contain scenario rows",
      });

      summary.errors = errors.length;
      return { rows: [], summary, errors };
    }

    const pozoRows = await databaseService.readAll(
      `SELECT id, nombre FROM Pozo WHERE proyectoId = ?`,
      [payload.proyectoId],
    );

    const capaRows = await databaseService.readAll(
      `SELECT id, nombre FROM Capa WHERE proyectoId = ?`,
      [payload.proyectoId],
    );

    const pozoByName = new Map<string, string>();
    for (const row of pozoRows) {
      pozoByName.set(normalizeKey(String(row.nombre)), String(row.id));
    }

    const capaByName = new Map<string, string>();
    for (const row of capaRows) {
      capaByName.set(normalizeKey(String(row.nombre)), String(row.id));
    }

    const resolvedRows: ResolvedScenarioRow[] = [];
    const seenLogicalKeys = new Set<string>();

    for (const row of parsedRows) {
      const rowErrors = validateScenarioRowByType(row, payload.tipoEscenarioId);

      let pozoId: string | null = null;
      let capaId: string | null = null;

      if (row.pozo) {
        pozoId = pozoByName.get(normalizeKey(row.pozo)) ?? null;
        if (!pozoId) {
          rowErrors.push({
            rowNumber: row.rowNumber,
            field: "pozo",
            severity: "error",
            message: `Pozo no encontrado en el proyecto: ${row.pozo}`,
          });
        }
      }

      if (payload.tipoEscenarioId === "datos" && row.capa) {
        capaId = capaByName.get(normalizeKey(row.capa)) ?? null;
        if (!capaId) {
          rowErrors.push({
            rowNumber: row.rowNumber,
            field: "capa",
            severity: "error",
            message: `Capa no encontrada en el proyecto: ${row.capa}`,
          });
        }
      }

      if (payload.tipoEscenarioId === "historia") {
        capaId = null;
      }

      if (rowErrors.length === 0 && pozoId) {
        const logicalKey = buildScenarioLogicalKey(
          payload.tipoEscenarioId,
          pozoId,
          row.fecha,
          capaId,
        );

        if (seenLogicalKeys.has(logicalKey)) {
          rowErrors.push({
            rowNumber: row.rowNumber,
            field: "duplicate",
            severity: "error",
            message: "duplicated logical row in TXT",
          });
        } else {
          seenLogicalKeys.add(logicalKey);
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        summary.rejectedRows += 1;
        continue;
      }

      resolvedRows.push({
        rowNumber: row.rowNumber,
        pozoId: pozoId as string,
        capaId,
        fecha: row.fecha,
        petroleo: row.petroleo,
        agua: row.agua,
        gas: row.gas,
        inyeccionGas: row.inyeccionGas,
        inyeccionAgua: row.inyeccionAgua,
      });
      summary.acceptedRows += 1;
    }

    summary.errors = errors.length;
    return { rows: resolvedRows, summary, errors };
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const importService = new ImportService();
