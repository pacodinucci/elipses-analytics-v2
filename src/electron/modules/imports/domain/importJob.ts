// src/electron/modules/imports/domain/importJob.ts
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
  grupoVariableId: string;
  xedges: number[];
  yedges: number[];
  grid: number[][];
}

export interface MapImportPayload {
  rows: MapImportRow[];
}

export interface CapaTxtImportPayload {
  proyectoId: string;
  content: string;
}

export interface PozoTxtImportPayload {
  proyectoId: string;
  content: string;
}

export interface ScenarioTxtImportPayload {
  proyectoId: string;
  tipoEscenarioId: string;
  nombreEscenario: string;
  content: string;
}

export interface SetEstadoPozosLargeImportPayload {
  proyectoId: string;
  nombreSetEstadoPozos: string;
  filePath: string;
  requestId?: string;
}

export interface SetEstadoPozosLargeUnresolvedRow {
  rowNumber: number;
  pozo: string;
  capa: string;
  fecha: string;
  estado: string;
  reason: string;
}

export interface SetEstadoPozosLargeCommitResult {
  ok: boolean;
  setEstadoPozosId: string;
  totalRows: number;
  insertedRows: number;
  unresolvedRows: number;
  unresolvedSample: SetEstadoPozosLargeUnresolvedRow[];
  previewRows: Array<{ rowNumber: number; cells: string[] }>;
  unresolvedSampleTruncated: boolean;
}

export interface SetEstadoPozosLargeProgress {
  requestId?: string;
  phase: "starting" | "processing" | "finalizing" | "done";
  totalBytes: number;
  processedBytes: number;
  processedRows: number;
  unresolvedRows: number;
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
  entity: "Mapa" | "Capa" | "Pozo" | "Escenario";
  mode: "dry-run" | "commit";
  status: "completed" | "failed";
  summary: ImportJobSummary;
  errors: ImportJobError[];
}

export function validateMapImportPayload(payload: MapImportPayload): void {
  if (
    !payload.rows ||
    !Array.isArray(payload.rows) ||
    payload.rows.length === 0
  ) {
    throw new Error("Map import requires at least one row");
  }
}

export function validateCapaTxtImportPayload(
  payload: CapaTxtImportPayload,
): void {
  if (!payload.proyectoId?.trim()) {
    throw new Error("Layer import requires proyectoId");
  }
  if (!payload.content?.trim()) {
    throw new Error("Layer import requires TXT content");
  }
}

export function validatePozoTxtImportPayload(
  payload: PozoTxtImportPayload,
): void {
  if (!payload.proyectoId?.trim()) {
    throw new Error("Well import requires proyectoId");
  }
  if (!payload.content?.trim()) {
    throw new Error("Well import requires TXT content");
  }
}

export function validateScenarioTxtImportPayload(
  payload: ScenarioTxtImportPayload,
): void {
  if (!payload.proyectoId?.trim()) {
    throw new Error("Scenario import requires proyectoId");
  }
  if (!payload.tipoEscenarioId?.trim()) {
    throw new Error("Scenario import requires tipoEscenarioId");
  }
  if (!payload.nombreEscenario?.trim()) {
    throw new Error("Scenario import requires nombreEscenario");
  }
  if (!payload.content?.trim()) {
    throw new Error("Scenario import requires TXT content");
  }
}

export function validateSetEstadoPozosLargeImportPayload(
  payload: SetEstadoPozosLargeImportPayload,
): void {
  if (!payload.proyectoId?.trim()) {
    throw new Error("Set Estado Pozos import requires proyectoId");
  }
  if (!payload.nombreSetEstadoPozos?.trim()) {
    throw new Error("Set Estado Pozos import requires nombreSetEstadoPozos");
  }
  if (!payload.filePath?.trim()) {
    throw new Error("Set Estado Pozos import requires filePath");
  }
}
