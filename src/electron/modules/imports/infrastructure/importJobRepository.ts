import { randomUUID } from "node:crypto";
import { databaseService } from "../../../shared/db/index.js";
import type { ImportJobError, ImportJobSummary } from "../domain/importJob.js";

export class ImportJobRepository {
  async createJob(
    entity: string,
    mode: "dry-run" | "commit",
    summary: ImportJobSummary,
  ): Promise<string> {
    const jobId = randomUUID();
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO import_jobs (
        id, entity, mode, status, createdAt, finishedAt, summaryJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [jobId, entity, mode, "running", now, null, JSON.stringify(summary)],
    );

    return jobId;
  }

  async completeJob(
    jobId: string,
    status: "completed" | "failed",
    summary: ImportJobSummary,
  ): Promise<void> {
    await databaseService.run(
      `UPDATE import_jobs
       SET status = ?,
           finishedAt = ?,
           summaryJson = ?
       WHERE id = ?`,
      [status, new Date().toISOString(), JSON.stringify(summary), jobId],
    );
  }

  async addErrors(jobId: string, errors: ImportJobError[]): Promise<void> {
    for (const err of errors) {
      await databaseService.run(
        `INSERT INTO import_job_errors (
          id, jobId, rowNumber, field, severity, message, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          jobId,
          err.rowNumber,
          err.field ?? null,
          err.severity,
          err.message,
          new Date().toISOString(),
        ],
      );
    }
  }
}
