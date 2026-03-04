// src/electron/modules/imports/domain/importJob.ts

export type ImportSeverity = "error" | "warning";

export interface ImportJobError {
  rowNumber: number;
  field?: string;
  severity: ImportSeverity;
  message: string;
}

// =========================
// Mapas
// =========================
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

// =========================
// Capas (TXT)
// =========================
export interface CapaTxtImportPayload {
  proyectoId: string;
  content: string;
}

// =========================
// ✅ Pozos (TXT tab/space)
// =========================
// Formato real (según tus capturas):
// Header: "pozo x y"  (puede venir en la 1ra línea)
// Filas: <pozo> <x> <y> (separado por tabs/espacios)
// X/Y pueden venir con coma decimal: 694720,6
export interface PozoTxtImportPayload {
  proyectoId: string;
  content: string;
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
  entity: "Mapa" | "Capa" | "Pozo";
  mode: "dry-run" | "commit";
  status: "completed" | "failed";
  summary: ImportJobSummary;
  errors: ImportJobError[];
}

// =========================
// Validators
// =========================
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
