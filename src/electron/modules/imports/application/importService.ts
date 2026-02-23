import { randomUUID } from "node:crypto";
import { migrations } from "../../../shared/db/migrations.js";
import { databaseService } from "../../../shared/db/index.js";
import { coreDataService } from "../../core-data/application/coreDataService.js";
import { mapService } from "../../maps/application/mapService.js";
import type {
  CapaTxtImportPayload,
  ImportJobError,
  ImportJobResult,
  ImportJobSummary,
  MapImportPayload,
  MapImportRow,
} from "../domain/importJob.js";
import {
  validateCapaTxtImportPayload,
  validateMapImportPayload,
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

function validateRow(row: MapImportRow, rowNumber: number): ImportJobError[] {
  const errors: ImportJobError[] = [];

  if (!row.id)
    errors.push({
      rowNumber,
      field: "id",
      severity: "error",
      message: "id is required",
    });

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

  if (lines.length === 0) {
    return [];
  }

  return lines
    .map((line, index) => ({ line, rowNumber: index + 1 }))
    .filter(
      ({ line, rowNumber }) =>
        !(rowNumber === 1 && line.toLowerCase() === "capa"),
    )
    .map(({ line, rowNumber }) => ({ rowNumber, nombre: line }));
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
      const rowErrors = validateRow(row, index + 1);
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

    if (errors.length > 0) {
      await this.repository.addErrors(jobId, errors);
    }

    await this.repository.completeJob(jobId, status, summary);

    return {
      jobId,
      entity: "Mapa",
      mode: "dry-run",
      status,
      summary,
      errors,
    };
  }

  async commitMapImport(payload: MapImportPayload): Promise<ImportJobResult> {
    validateMapImportPayload(payload);
    await this.ensureSchema();

    const dryRun = await this.dryRunMapImport(payload);
    if (dryRun.errors.length > 0) {
      return {
        ...dryRun,
        mode: "commit",
        status: "failed",
      };
    }

    const summary = emptySummary(payload.rows.length);
    const errors: ImportJobError[] = [];
    const jobId = await this.repository.createJob("Mapa", "commit", summary);

    for (let i = 0; i < payload.rows.length; i += 1) {
      const row = payload.rows[i];
      try {
        // MapImportRow está alineado con UpsertMapInput (incluye grupoVariableId)
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

    if (errors.length > 0) {
      await this.repository.addErrors(jobId, errors);
    }

    await this.repository.completeJob(jobId, status, summary);

    return {
      jobId,
      entity: "Mapa",
      mode: "commit",
      status,
      summary,
      errors,
    };
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

    if (errors.length > 0) {
      await this.repository.addErrors(jobId, errors);
    }

    await this.repository.completeJob(jobId, status, summary);

    return {
      jobId,
      entity: "Capa",
      mode: "dry-run",
      status,
      summary,
      errors,
    };
  }

  async commitCapaTxtImport(
    payload: CapaTxtImportPayload,
  ): Promise<ImportJobResult> {
    validateCapaTxtImportPayload(payload);
    await this.ensureSchema();

    const dryRun = await this.dryRunCapaTxtImport(payload);
    if (dryRun.errors.length > 0) {
      return {
        ...dryRun,
        mode: "commit",
        status: "failed",
      };
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

    if (errors.length > 0) {
      await this.repository.addErrors(jobId, errors);
    }

    await this.repository.completeJob(jobId, status, summary);

    return {
      jobId,
      entity: "Capa",
      mode: "commit",
      status,
      summary,
      errors,
    };
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const importService = new ImportService();
