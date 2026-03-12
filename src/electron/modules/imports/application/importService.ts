// src/electron/modules/imports/application/importService.ts
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import readline from "node:readline";
import { migrations } from "../../../shared/db/migrations.js";
import { databaseService } from "../../../shared/db/index.js";
import { coreDataService } from "../../core-data/application/coreDataService.js";
import { mapService } from "../../maps/application/mapService.js";
import { scenarioService } from "../../scenarios/application/scenarioService.js";
import { scenarioValueService } from "../../scenario-values/application/scenarioValueService.js";
import { wellStatesService } from "../../well-states/application/wellStatesService.js";

import type {
  CapaTxtImportPayload,
  ImportJobError,
  ImportJobResult,
  ImportJobSummary,
  MapImportPayload,
  MapImportRow,
  PozoTxtImportPayload,
  SetEstadoPozosLargeCommitResult,
  SetEstadoPozosLargeImportPayload,
  SetEstadoPozosLargeProgress,
  SetEstadoPozosLargeUnresolvedRow,
  ScenarioTxtImportPayload,
} from "../domain/importJob.js";

import {
  validateCapaTxtImportPayload,
  validateMapImportPayload,
  validatePozoTxtImportPayload,
  validateSetEstadoPozosLargeImportPayload,
  validateScenarioTxtImportPayload,
} from "../domain/importJob.js";

import { ImportJobRepository } from "../infrastructure/importJobRepository.js";

const SET_ESTADO_UNRESOLVED_SAMPLE_MAX = 20000;
const SET_ESTADO_INSERT_BATCH_SIZE = 2000;
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
  if (Number.isNaN(d.getTime())) return false;

  const [yyyy, mm, dd] = value.split("-").map(Number);
  return (
    d.getUTCFullYear() === yyyy &&
    d.getUTCMonth() + 1 === mm &&
    d.getUTCDate() === dd
  );
}

function normalizeScenarioDate(raw: string): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  // YYYY-MM-DD
  if (isValidISODate(value)) {
    return value;
  }
  // DD/MM/YYYY o D/M/YYYY
  const dayMonthYearMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayMonthYearMatch) {
    const day = Number(dayMonthYearMatch[1]);
    const month = Number(dayMonthYearMatch[2]);
    const year = Number(dayMonthYearMatch[3]);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return isValidISODate(normalized) ? normalized : null;
    }
  }

  // YYYY-MM
  const isoMonthMatch = value.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonthMatch) {
    const year = Number(isoMonthMatch[1]);
    const month = Number(isoMonthMatch[2]);

    if (month >= 1 && month <= 12) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
      return isValidISODate(normalized) ? normalized : null;
    }
  }

  // MM-YYYY o M-YYYY
  const monthYearMatch = value.match(/^(\d{1,2})-(\d{4})$/);
  if (monthYearMatch) {
    const month = Number(monthYearMatch[1]);
    const year = Number(monthYearMatch[2]);

    if (month >= 1 && month <= 12) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
      return isValidISODate(normalized) ? normalized : null;
    }
  }

  return null;
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
    [
      "inyeccionagua",
      "agua_iny",
      "agua_inyectada",
      "inyeccion_agua",
      "agua_inv",
    ].includes(key)
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
  fechaRaw: string;
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
      fechaRaw: (data.fecha ?? "").trim(),
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

  if (!row.fechaRaw) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "fecha",
      severity: "error",
      message: "fecha is required",
    });
  } else if (!normalizeScenarioDate(row.fechaRaw)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "fecha",
      severity: "error",
      message: "fecha must be YYYY-MM-DD, YYYY-MM or MM-YYYY",
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

  if (tipoEscenarioId === "historia" && row.capa) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "capa",
      severity: "error",
      message: 'tipo "historia" no admite capa',
    });
  }

  if (tipoEscenarioId === "datos" && !row.capa) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "capa",
      severity: "error",
      message: 'tipo "datos" requiere capa',
    });
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

      const normalizedFecha = normalizeScenarioDate(row.fechaRaw);

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

      if (!normalizedFecha) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          field: "fecha",
          severity: "error",
          message: `Fecha inválida: ${row.fechaRaw}`,
        });
      }

      if (rowErrors.length === 0 && pozoId && normalizedFecha) {
        const logicalKey = buildScenarioLogicalKey(
          payload.tipoEscenarioId,
          pozoId,
          normalizedFecha,
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
        fecha: normalizedFecha as string,
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


  async commitSetEstadoPozosLargeImport(
    payload: SetEstadoPozosLargeImportPayload,
    onProgress?: (progress: SetEstadoPozosLargeProgress) => void,
  ): Promise<SetEstadoPozosLargeCommitResult> {
    validateSetEstadoPozosLargeImportPayload(payload);
    await this.ensureSchema();
    await wellStatesService.ensureDefaultTiposEstadoPozo();

    if (!fs.existsSync(payload.filePath)) {
      throw new Error(`Archivo no encontrado: ${payload.filePath}`);
    }

    const totalBytes = Number(fs.statSync(payload.filePath).size || 0);
    let processedBytes = 0;
    let lastProgressTs = 0;
    let totalRows = 0;
    let unresolvedRows = 0;

    const emitProgress = (phase: SetEstadoPozosLargeProgress["phase"], force = false) => {
      const now = Date.now();
      if (!force && phase === "processing" && now - lastProgressTs < 250) return;
      lastProgressTs = now;
      try {
        onProgress?.({
          requestId: payload.requestId,
          phase,
          totalBytes,
          processedBytes: Math.min(processedBytes, totalBytes),
          processedRows: totalRows,
          unresolvedRows,
        });
      } catch {
        // ignore progress callback failures
      }
    };

    emitProgress("starting", true);

    const normalizeCell = (raw: unknown): string =>
      String(raw ?? "")
        .replace(/\u0000/g, "")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
        .replace(/[\u2010-\u2015\u2212]/g, "-")
        .replace(/\u00A0/g, " ")
        .trim();

    const countDelimiter = (line: string, delimiter: string): number => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (!inQuotes && ch === delimiter) count += 1;
      }
      return count;
    };

    const detectDelimiter = (line: string): string | null => {
      const candidates = [",", ";", "\t"] as const;
      let best: string | null = null;
      let bestScore = 0;
      for (const c of candidates) {
        const score = countDelimiter(line, c);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      return bestScore > 0 ? best : null;
    };

    const splitDelimited = (line: string, delimiter: string): string[] => {
      const out: string[] = [];
      let token = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            token += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }

        if (!inQuotes && ch === delimiter) {
          out.push(normalizeCell(token));
          token = "";
          continue;
        }

        token += ch;
      }

      out.push(normalizeCell(token));
      return out;
    };

    const normalizeHeader = (
      raw: string,
    ): "pozo" | "capa" | "fecha" | "estado" | "__ignore__" => {
      const key = raw
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9_]/g, "");
      if (key === "pozo" || key === "well") return "pozo";
      if (key === "capa" || key === "layer") return "capa";
      if (key === "fecha" || key === "date") return "fecha";
      if (
        key === "estado" ||
        key === "status" ||
        key === "tipoestado" ||
        key === "tipo_estado" ||
        key === "tipoestadopozo"
      ) {
        return "estado";
      }
      return "__ignore__";
    };

    const existingSets = await databaseService.readAll(
      `SELECT id, nombre FROM SetEstadoPozos WHERE proyectoId = ?`,
      [payload.proyectoId],
    );
    const wantedName = payload.nombreSetEstadoPozos.trim();

    const sameNameSet = existingSets.find(
      (s) =>
        String(s.nombre ?? "").trim().toLowerCase() ===
        wantedName.toLowerCase(),
    );

    const setEstadoPozosId = sameNameSet
      ? String(sameNameSet.id)
      : (
          await wellStatesService.createSetEstadoPozos({
            id: randomUUID(),
            proyectoId: payload.proyectoId,
            simulacionId: null,
            nombre: wantedName,
          })
        ).id;

    const tipos = await wellStatesService.listTiposEstadoPozo();
    const tipoByNombre = new Map<string, string>();
    for (const t of tipos) {
      tipoByNombre.set(String(t.nombre).trim().toLowerCase(), String(t.id));
    }

    const pozoRows = await databaseService.readAll(
      `SELECT id, nombre FROM Pozo WHERE proyectoId = ?`,
      [payload.proyectoId],
    );
    const capaRows = await databaseService.readAll(
      `SELECT id, nombre FROM Capa WHERE proyectoId = ?`,
      [payload.proyectoId],
    );

    const pozoByNombre = new Map<string, string>();
    for (const p of pozoRows) {
      pozoByNombre.set(normalizeKey(String(p.nombre ?? "")), String(p.id));
    }

    const capaByNombre = new Map<string, string>();
    for (const c of capaRows) {
      capaByNombre.set(normalizeKey(String(c.nombre ?? "")), String(c.id));
    }

    const unresolvedSample: SetEstadoPozosLargeUnresolvedRow[] = [];
    const previewRows: Array<{ rowNumber: number; cells: string[] }> = [];
    const pendingRows: Array<{
      id: string;
      setEstadoPozosId: string;
      pozoId: string;
      capaId: string;
      capaScopeKey: string;
      fecha: string;
      tipoEstadoPozoId: string;
    }> = [];

    const initialRowCount = Number(
      (
        (await databaseService.readAll(
                    `SELECT COUNT(*) AS c FROM SetEstadoPozosDetalle WHERE setEstadoPozosId = ?`,
          [setEstadoPozosId],
        ))[0]
      )?.c ?? 0,
    );

    totalRows = 0;
    unresolvedRows = 0;

    let delimiter: string | null = null;
    let colPozo = -1;
    let colCapa = -1;
    let colFecha = -1;
    let colEstado = -1;

    let headerReady = false;
    let headerSearchLines = 0;

    const detectFileEncoding = (): BufferEncoding => {
      const sampleSize = 512;
      const fd = fs.openSync(payload.filePath, "r");
      const sample = Buffer.alloc(sampleSize);
      let bytesRead = 0;
      try {
        bytesRead = fs.readSync(fd, sample, 0, sampleSize, 0);
      } finally {
        fs.closeSync(fd);
      }

      if (bytesRead >= 3) {
        if (sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) {
          return "utf8";
        }
      }
      if (bytesRead >= 2) {
        if (
          (sample[0] === 0xff && sample[1] === 0xfe) ||
          (sample[0] === 0xfe && sample[1] === 0xff)
        ) {
          return "utf16le";
        }
      }

      let zeroAtEven = 0;
      let zeroAtOdd = 0;
      const inspect = Math.min(bytesRead, 200);
      for (let i = 0; i < inspect; i += 1) {
        if (sample[i] !== 0x00) continue;
        if (i % 2 === 0) zeroAtEven += 1;
        else zeroAtOdd += 1;
      }

      if (zeroAtEven > 20 || zeroAtOdd > 20) {
        return "utf16le";
      }

      return "utf8";
    };

    const fileEncoding = detectFileEncoding();
    const stream = fs.createReadStream(payload.filePath, {
      encoding: fileEncoding,
    });
    stream.on("data", (chunk: string | Buffer) => {
      if (typeof chunk === "string") {
        processedBytes += Buffer.byteLength(chunk, fileEncoding);
      } else {
        processedBytes += chunk.byteLength;
      }
      emitProgress("processing");
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    let physicalLine = 0;

    await databaseService.run("BEGIN TRANSACTION");

    try {
      for await (const rawLine of rl) {
        physicalLine += 1;
        const line = normalizeCell(rawLine);
        if (!line) continue;

        if (!headerReady) {
          const lowerLine = line.trim().toLowerCase();
          if (lowerLine.startsWith("sep=")) continue;

          headerSearchLines += 1;
          delimiter = detectDelimiter(line);
          const headerTokens = delimiter
            ? splitDelimited(line, delimiter)
            : line.split(/\s+/).map((x) => normalizeCell(x));

          const normalizedHeader = headerTokens.map((h) => normalizeHeader(h));
          colPozo = normalizedHeader.findIndex((h) => h === "pozo");
          colCapa = normalizedHeader.findIndex((h) => h === "capa");
          colFecha = normalizedHeader.findIndex((h) => h === "fecha");
          colEstado = normalizedHeader.findIndex((h) => h === "estado");

          if (colPozo < 0 || colCapa < 0 || colFecha < 0 || colEstado < 0) {
            if (headerSearchLines <= 50) {
              continue;
            }

            // Fallback defensivo: si no detecta header por nombre,
            // asume orden posicional pozo,capa,fecha,estado.
            if (headerTokens.length >= 4) {
              colPozo = 0;
              colCapa = 1;
              colFecha = 2;
              colEstado = 3;
              headerReady = true;
            } else {
              throw new Error(
                "Archivo invalido: se requieren columnas pozo, capa, fecha y estado.",
              );
            }
          } else {
            headerReady = true;
            continue;
          }
        }

        const tokens = delimiter
          ? splitDelimited(line, delimiter)
          : line.split(/\s+/).map((x) => normalizeCell(x));

        const pozo = normalizeCell(tokens[colPozo] ?? "").toUpperCase();
        const capa = normalizeCell(tokens[colCapa] ?? "").toUpperCase();
        const fechaRaw = normalizeCell(tokens[colFecha] ?? "");
        const estado = normalizeCell(tokens[colEstado] ?? "");

        if (previewRows.length < 100) {
          previewRows.push({
            rowNumber: physicalLine,
            cells: [pozo, capa, fechaRaw, estado],
          });
        }

        totalRows += 1;

        const problems: string[] = [];
        const fecha = normalizeScenarioDate(fechaRaw);
        if (!pozo) problems.push("pozo vacio");
        if (!capa) problems.push("capa vacia");
        if (!fecha) problems.push("fecha invalida");
        if (!["-1", "0", "1", "2"].includes(estado)) {
          problems.push("estado invalido");
        }

        const pozoId = pozoByNombre.get(normalizeKey(pozo)) ?? null;
        if (!pozoId) problems.push("pozo no existe en proyecto");

        const capaId = capaByNombre.get(normalizeKey(capa)) ?? null;
        if (!capaId) problems.push("capa no existe en proyecto");

        const tipoEstadoPozoId = tipoByNombre.get(estado.toLowerCase()) ?? null;
        if (!tipoEstadoPozoId) problems.push("tipo estado no existe");

        if (
          problems.length > 0 ||
          !pozoId ||
          !capaId ||
          !fecha ||
          !tipoEstadoPozoId
        ) {
          unresolvedRows += 1;
          if (unresolvedSample.length < SET_ESTADO_UNRESOLVED_SAMPLE_MAX) {
            unresolvedSample.push({
              rowNumber: physicalLine,
              pozo,
              capa,
              fecha: fechaRaw,
              estado,
              reason: problems.join(", "),
            });
          }
          continue;
        }

        pendingRows.push({
          id: randomUUID(),
          setEstadoPozosId,
          pozoId,
          capaId,
          capaScopeKey: capaId,
          fecha,
          tipoEstadoPozoId,
        });

        if (pendingRows.length >= SET_ESTADO_INSERT_BATCH_SIZE) {
          await flushPendingRows();
        }
      }

      await flushPendingRows();
      await databaseService.run("COMMIT");
    } catch (error) {
      try {
        await databaseService.run("ROLLBACK");
      } catch {
        // noop
      }
      throw error;
    }

    async function flushPendingRows(): Promise<void> {
      if (pendingRows.length === 0) return;

      const now = new Date().toISOString();
      const placeholders: string[] = [];
      const params: unknown[] = [];

      for (const row of pendingRows) {
        placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, '{}')");
        params.push(
          row.id,
          row.setEstadoPozosId,
          row.pozoId,
          row.capaId,
          row.capaScopeKey,
          row.fecha,
          row.tipoEstadoPozoId,
          now,
          now,
        );
      }

      await databaseService.run(
        `INSERT INTO SetEstadoPozosDetalle (
          id,
          setEstadoPozosId,
          pozoId,
          capaId,
          capaScopeKey,
          fecha,
          tipoEstadoPozoId,
          createdAt,
          updatedAt,
          extrasJson
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT(setEstadoPozosId, pozoId, capaScopeKey, fecha) DO NOTHING`,
        params,
      );

      pendingRows.length = 0;
    }
    emitProgress("finalizing", true);

    const finalRowCount = Number(
      (
        (await databaseService.readAll(
                    `SELECT COUNT(*) AS c FROM SetEstadoPozosDetalle WHERE setEstadoPozosId = ?`,
          [setEstadoPozosId],
        ))[0]
      )?.c ?? 0,
    );

    emitProgress("done", true);

    return {
      ok: true,
      setEstadoPozosId,
      totalRows,
      insertedRows: Math.max(0, finalRowCount - initialRowCount),
      unresolvedRows,
      unresolvedSample,
      previewRows,
      unresolvedSampleTruncated:
        unresolvedRows > unresolvedSample.length,
    };
  }
  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const importService = new ImportService();






