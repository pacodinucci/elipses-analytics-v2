// src/ui/components/import/import-modal.types.ts
import type { PozoCapaResolveReport } from "../../lib/name-resolver";

export type TabKey =
  | "capas"
  | "pozoCapa"
  | "escenarios"
  | "maps"
  | "setEstadoPozos"
  | "database"
  | "help";

export type ImportKind =
  | "capas"
  | "pozoCapa"
  | "escenarios"
  | "maps"
  | "setEstadoPozos";

export type ImportJobResultUI = any;

export type ImportProgressPhase =
  | "idle"
  | "preparing"
  | "validating"
  | "dry-run"
  | "committing"
  | "done"
  | "error";

export type ImportProgress = {
  visible: boolean;
  kind: ImportKind;
  phase: ImportProgressPhase;
  current: number;
  total: number;
  message: string;
};

export const POZOCAPA_FIELDS = [
  { key: "pozo", label: "Pozo" },
  { key: "capa", label: "Capa" },
  { key: "tope", label: "Tope" },
  { key: "base", label: "Base" },
] as const;

export const SET_ESTADO_POZOS_FIELDS = [
  { key: "pozo", label: "Pozo" },
  { key: "capa", label: "Capa" },
  { key: "fecha", label: "Fecha" },
  { key: "estado", label: "Estado" },
] as const;

export type SetEstadoPozosFieldKey =
  (typeof SET_ESTADO_POZOS_FIELDS)[number]["key"];

export type SimpleImportRow = {
  rowNumber: number;
  cells: string[];
};

export type SetEstadoPozosImportState = {
  columns: string[];
  columnUnits: string[];
  rows: SimpleImportRow[];
  selectedCols: boolean[];
  selectedRows: boolean[];
  mapping: Array<SetEstadoPozosFieldKey | "__ignore__">;
  rowErrors: Record<number, string[]>;
  mappingErrors: string[];
};

export const SCENARIO_TYPE_OPTIONS = [
  { id: "historia", nombre: "Historia" },
  { id: "datos", nombre: "Datos" },
  { id: "primaria", nombre: "Primaria" },
  { id: "inyeccion", nombre: "Inyección" },
] as const;

export type PozoCapaViewMode = "all" | "unresolved";
export type ScenarioViewMode = "all" | "unresolved";
export type SetEstadoPozosViewMode = "all" | "unresolved";

export type InvalidCellsMap = Record<string, "missing" | "ambiguous">;

export type ScenarioResolvedRow = {
  rowIndex: number;
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

export type ScenarioResolveReport = {
  ok: boolean;
  totalSelected: number;
  resolved: number;

  missingPozos: Array<{
    rowIndex: number;
    rowNumber: number;
    pozoName: string;
  }>;
  missingCapas: Array<{
    rowIndex: number;
    rowNumber: number;
    capaName: string;
  }>;
  ambiguousPozos: Array<{
    rowIndex: number;
    rowNumber: number;
    pozoName: string;
    candidates: string[];
  }>;
  ambiguousCapas: Array<{
    rowIndex: number;
    rowNumber: number;
    capaName: string;
    candidates: string[];
  }>;
  invalidFechas: Array<{
    rowIndex: number;
    rowNumber: number;
    fecha: string;
  }>;
  missingMetrics: Array<{
    rowIndex: number;
    rowNumber: number;
  }>;
  duplicateLogicalRows: Array<{
    rowIndex: number;
    rowNumber: number;
  }>;

  unresolvedRowIndices: number[];
  rows: ScenarioResolvedRow[];
};

export type SetEstadoPozosResolveReport = {
  ok: boolean;
  totalSelected: number;
  resolved: number;

  missingPozos: Array<{
    rowIndex: number;
    rowNumber: number;
    pozoName: string;
  }>;
  missingCapas: Array<{
    rowIndex: number;
    rowNumber: number;
    capaName: string;
  }>;
  ambiguousPozos: Array<{
    rowIndex: number;
    rowNumber: number;
    pozoName: string;
    candidates: string[];
  }>;
  ambiguousCapas: Array<{
    rowIndex: number;
    rowNumber: number;
    capaName: string;
    candidates: string[];
  }>;
  invalidFechas: Array<{
    rowIndex: number;
    rowNumber: number;
    fecha: string;
  }>;
  invalidEstados: Array<{
    rowIndex: number;
    rowNumber: number;
    estado: string;
  }>;

  unresolvedRowIndices: number[];
};

export type InvalidBulkReplaceGroup = {
  id: string;
  label: string;
  value: string;
  colIndex: number;
  colLabel: string;
  rowIndices: number[];
  count: number;
};

export type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export type { PozoCapaResolveReport };