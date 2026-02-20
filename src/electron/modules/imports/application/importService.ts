import { migrations } from "../../../shared/db/migrations.js";
import { databaseService } from "../../../shared/db/index.js";
import { mapService } from "../../maps/application/mapService.js";
import type {
  ImportJobError,
  ImportJobResult,
  ImportJobSummary,
  MapImportPayload,
  MapImportRow,
} from "../domain/importJob.js";
import { validateMapImportPayload } from "../domain/importJob.js";
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

  if (!row.id) errors.push({ rowNumber, field: "id", severity: "error", message: "id is required" });
  if (!row.proyectoId) {
    errors.push({ rowNumber, field: "proyectoId", severity: "error", message: "proyectoId is required" });
  }
  if (!row.capaId) errors.push({ rowNumber, field: "capaId", severity: "error", message: "capaId is required" });
  if (!row.variableMapaId) {
    errors.push({ rowNumber, field: "variableMapaId", severity: "error", message: "variableMapaId is required" });
  }

  if (!Array.isArray(row.xedges)) {
    errors.push({ rowNumber, field: "xedges", severity: "error", message: "xedges must be an array" });
  }
  if (!Array.isArray(row.yedges)) {
    errors.push({ rowNumber, field: "yedges", severity: "error", message: "yedges must be an array" });
  }
  if (!Array.isArray(row.grid)) {
    errors.push({ rowNumber, field: "grid", severity: "error", message: "grid must be an array" });
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
        await mapService.upsertMap(row);
        summary.acceptedRows += 1;
      } catch (error) {
        summary.rejectedRows += 1;
        errors.push({
          rowNumber: i + 1,
          severity: "error",
          message: error instanceof Error ? error.message : "Unknown map import error",
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

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const importService = new ImportService();
