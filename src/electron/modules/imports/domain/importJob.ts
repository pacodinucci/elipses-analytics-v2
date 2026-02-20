export type ImportSeverity = "error" | "warning";

export interface ImportJobError {
  rowNumber: number;
  field?: string;
  severity: ImportSeverity;
  message: string;
}

export interface MapImportRow {
  id: string;
  proyectoId: string;
  capaId: string;
  variableMapaId: string;
  xedges: number[];
  yedges: number[];
  grid: number[][];
}

export interface MapImportPayload {
  rows: MapImportRow[];
}

export interface ImportJobSummary {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  warnings: number;
  errors: number;
}

export interface ImportJobResult {
  jobId: string;
  entity: "Mapa";
  mode: "dry-run" | "commit";
  status: "completed" | "failed";
  summary: ImportJobSummary;
  errors: ImportJobError[];
}

export function validateMapImportPayload(payload: MapImportPayload): void {
  if (!payload.rows || !Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("Map import requires at least one row");
  }
}
