import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  OptionsShellModal,
  type OptionsNavItem,
} from "../mapa/options-shell-modal";
import { TbFileImport, TbDatabase, TbInfoCircle } from "react-icons/tb";
import "./import-modal.css";

import { useSelectionStore } from "../../store/selection-store";
import { invalidateCapasCache } from "../../hooks/use-capas";

import { useNewProjectWizardStore } from "../../store/new-project-wizard-store";

import {
  buildResolverIndex,
  resolveNameToId,
  resolvePozoCapaRows,
  type NameEntity,
  type PozoCapaResolveReport,
} from "../../lib/name-resolver";

type TabKey =
  | "capas"
  | "pozoCapa"
  | "escenarios"
  | "setEstadoPozos"
  | "maps"
  | "database"
  | "help";

type ImportKind = "capas" | "pozoCapa" | "escenarios" | "maps" | "setEstadoPozos";

type ImportJobResultUI = any;

type ImportProgressPhase =
  | "idle"
  | "preparing"
  | "validating"
  | "dry-run"
  | "committing"
  | "done"
  | "error";

type ImportProgress = {
  visible: boolean;
  kind: ImportKind;
  phase: ImportProgressPhase;
  current: number;
  total: number;
  message: string;
  unit?: "rows" | "bytes";
};

const POZOCAPA_FIELDS = [
  { key: "pozo", label: "Pozo" },
  { key: "capa", label: "Capa" },
  { key: "tope", label: "Tope" },
  { key: "base", label: "Base" },
] as const;

const SET_ESTADO_POZOS_FIELDS = [
  { key: "pozo", label: "Pozo" },
  { key: "capa", label: "Capa" },
  { key: "fecha", label: "Fecha" },
  { key: "estado", label: "Estado" },
] as const;

const VALID_WELL_STATES = new Set(["-1", "0", "1", "2"]);
const MAX_TABULAR_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TABULAR_ROWS = 120000;

const SCENARIO_TYPE_OPTIONS = [
  { id: "historia", nombre: "Historia" },
  { id: "datos", nombre: "Datos" },
  { id: "primaria", nombre: "Primaria" },
  { id: "inyeccion", nombre: "Inyección" },
] as const;

type PozoCapaViewMode = "all" | "unresolved";
type ScenarioViewMode = "all" | "unresolved";

type InvalidCellReason = "missing" | "ambiguous" | "invalid" | "dbError";
type InvalidCellsMap = Record<string, InvalidCellReason>;

type ScenarioResolvedRow = {
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

type ScenarioResolveReport = {
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

type SetEstadoFieldKey = "pozo" | "capa" | "fecha" | "estado";

type SetEstadoImportState = {
  contentRaw: string;
  columns: string[];
  columnUnits: string[];
  rows: Array<{ rowNumber: number; cells: string[] }>;
  selectedCols: boolean[];
  selectedRows: boolean[];
  mapping: Array<SetEstadoFieldKey | "__ignore__">;
  rowErrors: Record<number, string[]>;
  mappingErrors: string[];
};

type SetEstadoResolvedRow = {
  rowIndex: number;
  rowNumber: number;
  pozoId: string;
  capaId: string;
  fecha: string;
  estado: string;
};

type SetEstadoResolveReport = {
  ok: boolean;
  totalSelected: number;
  resolved: number;
  missingPozos: Array<{ rowIndex: number; rowNumber: number; pozoName: string }>;
  missingCapas: Array<{ rowIndex: number; rowNumber: number; capaName: string }>;
  ambiguousPozos: Array<{ rowIndex: number; rowNumber: number; pozoName: string; candidates: string[] }>;
  ambiguousCapas: Array<{ rowIndex: number; rowNumber: number; capaName: string; candidates: string[] }>;
  invalidFechas: Array<{ rowIndex: number; rowNumber: number; fecha: string }>;
  invalidEstados: Array<{ rowIndex: number; rowNumber: number; estado: string; reason?: string }>;
  unresolvedRowIndices: number[];
  rows: SetEstadoResolvedRow[];
};

function emptySetEstadoImportState(): SetEstadoImportState {
  return {
    contentRaw: "",
    columns: [],
    columnUnits: [],
    rows: [],
    selectedCols: [],
    selectedRows: [],
    mapping: [],
    rowErrors: {},
    mappingErrors: [],
  };
}

function countUnquotedDelimiter(line: string, delimiter: string): number {
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
}

function cleanImportCell(raw: unknown): string {
  return String(raw ?? "")
    // Remove invisible control/format chars that break matching.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    // Normalize unicode dashes/minus to ASCII hyphen.
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .trim();
}
function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let n = value;
  let idx = 0;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx += 1;
  }
  return `${n.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}


async function readTabularFileText(
  file: File,
  opts?: { maxBytes?: number; skipSizeGuard?: boolean },
): Promise<string> {
  if (!opts?.skipSizeGuard && file.size > MAX_TABULAR_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = (MAX_TABULAR_FILE_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`Archivo demasiado grande (${mb} MB). Maximo soportado en modo interactivo: ${maxMb} MB.`);
  }

  const maxBytes =
    typeof opts?.maxBytes === "number" && opts.maxBytes > 0
      ? Math.min(opts.maxBytes, file.size)
      : file.size;
  const buffer = await file.slice(0, maxBytes).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const hasBomUtf16Le =
    bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
  const hasBomUtf16Be =
    bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;

  const encodings: string[] = hasBomUtf16Le
    ? ["utf-16le", "utf-8", "windows-1252", "iso-8859-1"]
    : hasBomUtf16Be
      ? ["utf-16be", "utf-8", "windows-1252", "iso-8859-1"]
      : ["utf-8", "utf-16le", "utf-16be", "windows-1252", "iso-8859-1"];

  const scoreDecoded = (rawText: string): number => {
    const text = rawText.split("\0").join("");
    if (!text.trim()) return -1_000_000;

    let score = 0;
    const lower = text.toLowerCase();

    if (lower.includes("pozo")) score += 30;
    if (lower.includes("capa")) score += 20;
    if (lower.includes("fecha")) score += 20;
    if (lower.includes("estado")) score += 20;

    const delimiterHits =
      (text.match(/,/g)?.length ?? 0) +
      (text.match(/;/g)?.length ?? 0) +
      (text.match(/\t/g)?.length ?? 0);
    score += Math.min(200, delimiterHits);

    const newlineHits = text.split(/\r\n|\n|\r/).length ?? 1;
    score += Math.min(500, newlineHits * 2);

    const replacementHits = text.match(/\uFFFD/g)?.length ?? 0;
    score -= replacementHits * 15;

    return score;
  };

  let bestText = "";
  let bestScore = -1_000_000;

  for (const encoding of encodings) {
    try {
      const decoded = new TextDecoder(encoding).decode(bytes);
      const score = scoreDecoded(decoded);
      if (score > bestScore) {
        bestScore = score;
        bestText = decoded;
      }
    } catch {
      // try next encoding
    }
  }

  return bestText.split("\0").join("");
}
function detectRowDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 8);
  const candidates = [",", ";", "\t"] as const;
  let best: string | null = null;
  let bestScore = 0;

  for (const delimiter of candidates) {
    let score = 0;
    for (const line of sample) {
      score += countUnquotedDelimiter(line, delimiter);
    }
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }

  return bestScore > 0 ? best : null;
}

function splitDelimitedRow(line: string, delimiter: string): string[] {
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
      out.push(cleanImportCell(token));
      token = "";
      continue;
    }

    token += ch;
  }

  out.push(cleanImportCell(token));
  return out;
}

function splitImportRow(line: string, delimiter: string | null): string[] {
  if (delimiter) return splitDelimitedRow(line, delimiter);
  return line
    .trim()
    .split(/\s+/)
    .map((x) => cleanImportCell(x))
    .filter(Boolean);
}

function isHeaderRow(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((t) => /^[A-Za-z_]+$/.test(t));
}

function isUnitsImportRow(tokens: string[], expectedCols: number): boolean {
  if (tokens.length === 0) return false;
  const bracketish = tokens.filter((t) => /^\s*\[.*\]\s*$/.test(t)).length;
  const ratio = bracketish / Math.max(1, expectedCols);
  return ratio >= 0.6;
}

function parseSetEstadoTabularTxt(content: string): {
  columns: string[];
  columnUnits: string[];
  rows: Array<{ rowNumber: number; cells: string[] }>;
} {
  const lines = content
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { columns: [], columnUnits: [], rows: [] };

  if (lines.length > MAX_TABULAR_ROWS) {
    throw new Error(`El archivo tiene ${lines.length} filas. Maximo soportado en modo interactivo: ${MAX_TABULAR_ROWS}.`);
  }

  const delimiter = detectRowDelimiter(lines);
  const firstTokens = splitImportRow(lines[0], delimiter).map((x) =>
    cleanImportCell(x.replace(/^\uFEFF/, "")),
  );
  const hasHeader = isHeaderRow(firstTokens);
  let dataStart = hasHeader ? 1 : 0;

  let maxCols = hasHeader ? firstTokens.length : 0;
  for (let i = dataStart; i < lines.length; i += 1) {
    maxCols = Math.max(maxCols, splitImportRow(lines[i], delimiter).length);
  }
  if (maxCols === 0) maxCols = 1;

  const columns = hasHeader
    ? [...firstTokens, ...Array(Math.max(0, maxCols ?? firstTokens.length)).fill("")]
        .slice(0, maxCols)
        .map((c, idx) => (c && c.trim() ? c.trim() : `col${idx + 1}`))
    : Array.from({ length: maxCols }, (_, i) => `col${i + 1}`);

  let columnUnits = Array.from({ length: maxCols }, () => "");
  if (hasHeader && lines.length > 1) {
    const maybeUnits = splitImportRow(lines[1], delimiter);
    if (isUnitsImportRow(maybeUnits, maxCols)) {
      columnUnits = [...maybeUnits, ...Array(Math.max(0, maxCols ?? maybeUnits.length)).fill("")]
        .slice(0, maxCols)
        .map((u) => (u ?? "").trim());
      dataStart = 2;
    }
  }

  const rows: Array<{ rowNumber: number; cells: string[] }> = [];
  for (let i = dataStart; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const tokens = splitImportRow(lines[i], delimiter);
    const cells = [...tokens, ...Array(Math.max(0, maxCols ?? tokens.length)).fill("")].slice(0, maxCols);
    rows.push({ rowNumber, cells });
  }

  return { columns, columnUnits, rows };
}

function buildSetEstadoPreviewState(content: string): SetEstadoImportState {
  const parsed = parseSetEstadoTabularTxt(content);
  const previewRows = parsed.rows.slice(0, 100);
  const selectedCols = parsed.columns.map(() => true);
  const mapping = autoMappingSetEstado(parsed.columns);

  return recomputeSetEstadoImportState({
    contentRaw: "",
    columns: parsed.columns,
    columnUnits: parsed.columnUnits,
    rows: uppercaseSetPozoCells(previewRows, mapping),
    selectedCols,
    selectedRows: previewRows.map(() => true),
    mapping,
    rowErrors: {},
    mappingErrors: [],
  });
}
function autoMappingSetEstado(columns: string[]): Array<SetEstadoFieldKey | "__ignore__"> {
  const colLower = columns.map((c) => c.toLowerCase().trim());
  return colLower.map((c) => {
    if (c === "pozo" || c === "well") return "pozo";
    if (c === "capa" || c === "layer") return "capa";
    if (c === "fecha" || c === "date") return "fecha";
    if (c === "estado" || c === "status" || c === "tipoestado" || c === "tipo_estado") return "estado";
    return "__ignore__";
  });
}

function effectiveSetMapping(
  mapping: Array<SetEstadoFieldKey | "__ignore__">,
  selectedCols: boolean[],
): Array<SetEstadoFieldKey | "__ignore__"> {
  return mapping.map((m, idx) => (selectedCols[idx] ? m : "__ignore__"));
}

function validateSetEstadoMapping(mapping: Array<SetEstadoFieldKey | "__ignore__">): string[] {
  const errs: string[] = [];
  const mapped = new Set(mapping.filter((m) => m !== "__ignore__"));
  const required: SetEstadoFieldKey[] = ["pozo", "capa", "fecha", "estado"];
  for (const r of required) {
    if (!mapped.has(r)) errs.push(`Falta mapear el campo requerido: '${r}'.`);
  }
  const counts = new Map<string, number>();
  for (const m of mapping) {
    if (m === "__ignore__") continue;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  for (const [k, v] of counts.entries()) {
    if (v > 1) errs.push(`El campo '${k}' esta asignado ${v} veces. Solo una.`);
  }
  return errs;
}

function validateSetEstadoRows(
  rows: Array<{ rowNumber: number; cells: string[] }>,
  mapping: Array<SetEstadoFieldKey | "__ignore__">,
  selectedRows: boolean[],
): Record<number, string[]> {
  const rowErrors: Record<number, string[]> = {};
  const findCol = (field: SetEstadoFieldKey) => mapping.findIndex((m) => m === field);
  const colPozo = findCol("pozo");
  const colCapa = findCol("capa");
  const colFecha = findCol("fecha");
  const colEstado = findCol("estado");

  const seen = new Set<string>();

  rows.forEach((row, idx) => {
    if (!selectedRows[idx]) return;
    const errs: string[] = [];

    const pozo = cleanImportCell(colPozo >= 0 ? row.cells[colPozo] : "");
    const capa = cleanImportCell(colCapa >= 0 ? row.cells[colCapa] : "");
    const fecha = cleanImportCell(colFecha >= 0 ? row.cells[colFecha] : "");
    const estado = cleanImportCell(colEstado >= 0 ? row.cells[colEstado] : "");

    if (!pozo) errs.push("Pozo requerido");
    if (!capa) errs.push("Capa requerida");
    if (!fecha) errs.push("Fecha requerida");
    else if (!isValidISODate(fecha) && !normalizeScenarioDate(fecha)) {
      errs.push("Fecha debe ser YYYY-MM-DD, DD/MM/YYYY, YYYY-MM o MM-YYYY");
    }
    if (!estado) errs.push("Estado requerido");
    else if (!VALID_WELL_STATES.has(estado)) {
      errs.push("Estado invalido. Valores permitidos: -1, 0, 1, 2");
    }

    if (pozo && capa && fecha) {
      const key = `${pozo.toLowerCase()}::${capa.toLowerCase()}::${fecha}`;
      if (seen.has(key)) errs.push("Duplicado logico en filas seleccionadas");
      else seen.add(key);
    }

    if (errs.length) rowErrors[idx] = errs;
  });

  return rowErrors;
}

function recomputeSetEstadoImportState(current: SetEstadoImportState): SetEstadoImportState {
  const eff = effectiveSetMapping(current.mapping, current.selectedCols);
  const mappingErrors = validateSetEstadoMapping(eff);
  const rowErrors =
    mappingErrors.length === 0
      ? validateSetEstadoRows(current.rows, eff, current.selectedRows)
      : {};

  return {
    ...current,
    mappingErrors,
    rowErrors,
  };
}

function uppercaseSetPozoCells(
  rows: Array<{ rowNumber: number; cells: string[] }>,
  mapping: Array<SetEstadoFieldKey | "__ignore__">,
): Array<{ rowNumber: number; cells: string[] }> {
  const pozoCol = mapping.findIndex((m) => m === "pozo");
  if (pozoCol < 0) return rows;

  return rows.map((row) => {
    const cells = [...row.cells];
    cells[pozoCol] = cleanImportCell(cells[pozoCol]).toUpperCase();
    return { ...row, cells };
  });
}
export type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function scenarioFieldOptionsForType(tipoEscenarioId: string) {
  const base = [
    { key: "pozo", label: "Pozo" },
    { key: "fecha", label: "Fecha" },
    { key: "petroleo", label: "Petróleo" },
    { key: "agua", label: "Agua" },
    { key: "gas", label: "Gas" },
    { key: "inyeccionGas", label: "Inyección Gas" },
    { key: "inyeccionAgua", label: "Inyección Agua" },
  ];

  if (tipoEscenarioId === "datos") {
    return [{ key: "capa", label: "Capa" }, ...base];
  }

  return base;
}

function parseNullableMetric(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
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
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (isValidISODate(value)) {
    return value;
  }

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

  const isoMonthMatch = value.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonthMatch) {
    const year = Number(isoMonthMatch[1]);
    const month = Number(isoMonthMatch[2]);

    if (month >= 1 && month <= 12) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
      return isValidISODate(normalized) ? normalized : null;
    }
  }

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

function groupRowsByLabel<T extends { rowIndex: number }>(
  items: T[],
  getLabel: (item: T) => string,
): Array<{ label: string; rowIndices: number[]; count: number }> {
  const map = new Map<string, Set<number>>();

  for (const item of items) {
    const label = getLabel(item).trim() || "(vacío)";
    if (!map.has(label)) map.set(label, new Set<number>());
    map.get(label)!.add(item.rowIndex);
  }

  return Array.from(map.entries())
    .map(([label, indices]) => ({
      label,
      rowIndices: Array.from(indices.values()).sort((a, b) => a - b),
      count: indices.size,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

type InvalidBulkReplaceGroup = {
  id: string;
  label: string;
  value: string;
  colIndex: number;
  colLabel: string;
  rowIndices: number[];
  count: number;
};

function buildInvalidBulkReplaceGroups(args: {
  rows: Array<{ cells: string[] }>;
  columns: string[];
  invalidCells: InvalidCellsMap;
  rowScope?: number[] | null;
}): InvalidBulkReplaceGroup[] {
  const { rows, columns, invalidCells, rowScope } = args;
  const scopeSet = rowScope ? new Set(rowScope) : null;

  const groups = new Map<
    string,
    { value: string; colIndex: number; rowIndices: Set<number> }
  >();

  for (const key of Object.keys(invalidCells ?? {})) {
    const [rowPart, colPart] = key.split(":");
    const rowIndex = Number(rowPart);
    const colIndex = Number(colPart);

    if (!Number.isInteger(rowIndex) || !Number.isInteger(colIndex)) continue;
    if (scopeSet && !scopeSet.has(rowIndex)) continue;

    const row = rows[rowIndex];
    if (!row) continue;

    const value = String(row.cells?.[colIndex] ?? "");
    const groupKey = `${colIndex}::${value}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        value,
        colIndex,
        rowIndices: new Set<number>(),
      });
    }

    groups.get(groupKey)!.rowIndices.add(rowIndex);
  }

  return Array.from(groups.entries())
    .map(([id, item]) => {
      const colLabel = (
        columns[item.colIndex] ?? `Columna ${item.colIndex + 1}`
      ).trim();
      const rowIndices = Array.from(item.rowIndices.values()).sort(
        (a, b) => a ?? b,
      );

      return {
        id,
        label: item.value.trim() || "(vacio)",
        value: item.value,
        colIndex: item.colIndex,
        colLabel,
        rowIndices,
        count: rowIndices.length,
      };
    })
    .sort((a, b) => b.count - a.count || a.colLabel.localeCompare(b.colLabel));
}
function buildInitialProgress(kind: ImportKind): ImportProgress {
  return {
    visible: true,
    kind,
    phase: "preparing",
    current: 0,
    total: 0,
    message: "Preparando importación...",
  };
}

function getProgressPercent(progress: ImportProgress | null): number {
  if (!progress || !progress.visible) return 0;
  if (progress.total <= 0) {
    if (progress.phase === "done") return 100;
    return 100;
  }
  return Math.max(
    0,
    Math.min(100, Math.round((progress.current / progress.total) * 100)),
  );
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const proyectoId = useSelectionStore((s) => s.selectedProyectoId);

  const {
    pozoCapaFile,
    setPozoCapaFile,
    pozoCapaImport,

    scenarioFile,
    setScenarioFile,
    scenarioImport,

    setImportFromContent,
    setImportMapping,
    setImportCell,

    setImportRowSelected,
    setImportColSelected,
    setImportAllRowsSelected,
    setImportAllColsSelected,

    validateImport,
    buildContentForCommit,
    clearImport,
  } = useNewProjectWizardStore();

  const items = useMemo<OptionsNavItem<TabKey>[]>(
    () => [
      {
        key: "capas",
        title: "Capas",
        subtitle: "Import TXT",
        icon: <TbFileImport />,
      },
      {
        key: "pozoCapa",
        title: "Pozo-Capa",
        subtitle: "Import TXT (tabla)",
        icon: <TbFileImport />,
      },
      {
        key: "escenarios",
        title: "Escenarios",
        subtitle: "Import TXT (tabla)",
        icon: <TbFileImport />,
      },
      {
        key: "setEstadoPozos",
        title: "Set Estado Pozos",
        subtitle: "Import TXT (tabla)",
        icon: <TbFileImport />,
      },
      {
        key: "maps",
        title: "Maps",
        subtitle: "Import rows (JSON)",
        icon: <TbFileImport />,
      },
      {
        key: "database",
        title: "Resultado",
        subtitle: "Último job",
        icon: <TbDatabase />,
      },
      {
        key: "help",
        title: "Ayuda",
        subtitle: "Formato esperado",
        icon: <TbInfoCircle />,
      },
    ],
    [],
  );

  const [activeKey, setActiveKey] = useState<TabKey>("capas");

  const [capasTxt, setCapasTxt] = useState<string>("");
  const [mapsJson, setMapsJson] = useState<string>("");

  const [scenarioTipoEscenarioId, setScenarioTipoEscenarioId] =
    useState<string>("datos");
  const [scenarioNombre, setScenarioNombre] = useState<string>("");

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastKind, setLastKind] = useState<ImportKind>("capas");
  const [lastDryRun, setLastDryRun] = useState<ImportJobResultUI | null>(null);
  const [lastCommit, setLastCommit] = useState<ImportJobResultUI | null>(null);

  const [pozoCapaViewMode, setPozoCapaViewMode] =
    useState<PozoCapaViewMode>("all");
  const [pozoCapaReport, setPozoCapaReport] =
    useState<PozoCapaResolveReport | null>(null);
  const [pozoCapaInvalidCells, setPozoCapaInvalidCells] =
    useState<InvalidCellsMap>({});

  const [scenarioViewMode, setScenarioViewMode] =
    useState<ScenarioViewMode>("all");
  const [scenarioReport, setScenarioReport] =
    useState<ScenarioResolveReport | null>(null);
  const [scenarioInvalidCells, setScenarioInvalidCells] =
    useState<InvalidCellsMap>({});

  const [setEstadoPozosNombre, setSetEstadoPozosNombre] = useState<string>("Estado base");
  const [setEstadoPozosFile, setSetEstadoPozosFile] = useState<File | null>(null);
  const [setEstadoPozosLargeFilePath, setSetEstadoPozosLargeFilePath] =
    useState<string | null>(null);
  const [setEstadoPozosImport, setSetEstadoPozosImport] =
    useState<SetEstadoImportState>(emptySetEstadoImportState());
  const [setEstadoPozosViewMode, setSetEstadoPozosViewMode] =
    useState<"all" | "unresolved">("all");
  const [setEstadoPozosReport, setSetEstadoPozosReport] =
    useState<SetEstadoResolveReport | null>(null);
  const [setEstadoPozosInvalidCells, setSetEstadoPozosInvalidCells] =
    useState<InvalidCellsMap>({});

  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const setEstadoLargeProgressRequestIdRef = useRef<string | null>(null);

  const resetScenarioResolutionState = () => {
    setScenarioReport(null);
    setScenarioInvalidCells({});
    setScenarioViewMode("all");
  };

  const resetSetEstadoResolutionState = () => {
    setSetEstadoPozosReport(null);
    setSetEstadoPozosInvalidCells({});
    setSetEstadoPozosViewMode("all");
  };

  const resetProgressState = () => {
    setProgress(null);
  };

  const updateProgress = (patch: Partial<ImportProgress>) => {
    setProgress((prev) => {
      const base =
        prev ??
        ({
          visible: true,
          kind,
          phase: "preparing",
          current: 0,
          total: 0,
          message: "",
        } satisfies ImportProgress);

      return {
        ...base,
        ...patch,
        visible: patch.visible ?? true,
      };
    });
  };

  const deselectScenarioRows = (rowIndices: number[]) => {
    const unique = Array.from(new Set(rowIndices)).sort((a, b) => a - b);
    for (const rowIndex of unique) {
      setImportRowSelected("Escenario", rowIndex, false);
    }
    resetScenarioResolutionState();
    setError(null);
  };

  useEffect(() => {
    const unsubscribe =
      window.electron.subscribeImportSetEstadoPozosLargeProgress((payload) => {
        const activeRequestId = setEstadoLargeProgressRequestIdRef.current;
        if (!activeRequestId) return;
        if (payload?.requestId && payload.requestId !== activeRequestId) return;

        const total =
          payload.totalBytes > 0
            ? payload.totalBytes
            : Math.max(1, payload.processedRows);
        const current =
          payload.totalBytes > 0 ? payload.processedBytes : payload.processedRows;

        updateProgress({
          kind: "setEstadoPozos",
          phase: "committing",
          current,
          total,
          unit: "bytes",
          message:
            `Procesando archivo grande... filas: ${payload.processedRows} | no resueltas: ${payload.unresolvedRows}`,
        });
      });

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setActiveKey("capas");
    setCapasTxt("");
    setMapsJson("");

    setScenarioTipoEscenarioId("datos");
    setScenarioNombre("");

    setIsRunning(false);
    setError(null);

    setLastKind("capas");
    setLastDryRun(null);
    setLastCommit(null);

    setPozoCapaViewMode("all");
    setPozoCapaReport(null);
    setPozoCapaInvalidCells({});

    resetScenarioResolutionState();
    setSetEstadoPozosNombre("Estado base");
    setSetEstadoPozosFile(null);
    setSetEstadoPozosImport(emptySetEstadoImportState());
    resetSetEstadoResolutionState();
    resetProgressState();

    setPozoCapaFile(null);
    clearImport("PozoCapa");

    setScenarioFile(null);
    clearImport("Escenario");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeKey !== "pozoCapa") return;
    if (!pozoCapaFile) return;

    const t = window.setTimeout(() => validateImport("PozoCapa"), 160);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    activeKey,
    pozoCapaFile,
    pozoCapaImport.selectedRows,
    pozoCapaImport.selectedCols,
    pozoCapaImport.mapping,
    pozoCapaImport.rows,
    validateImport,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeKey !== "escenarios") return;
    if (!scenarioFile) return;

    const t = window.setTimeout(() => validateImport("Escenario"), 160);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    activeKey,
    scenarioFile,
    scenarioImport.selectedRows,
    scenarioImport.selectedCols,
    scenarioImport.mapping,
    scenarioImport.rows,
    validateImport,
  ]);

  const kind: ImportKind =
    activeKey === "maps"
      ? "maps"
      : activeKey === "pozoCapa"
        ? "pozoCapa"
        : activeKey === "escenarios"
          ? "escenarios"
          : activeKey === "setEstadoPozos"
            ? "setEstadoPozos"
            : "capas";

  const panelTitle =
    activeKey === "capas"
      ? "Importar Capas"
      : activeKey === "pozoCapa"
        ? "Importar Pozo-Capa"
        : activeKey === "escenarios"
          ? "Importar Escenarios"
          : activeKey === "setEstadoPozos"
            ? "Importar Set Estado Pozos"
            : activeKey === "maps"
            ? "Importar Maps"
            : activeKey === "database"
              ? "Resultado"
              : "Ayuda y formato";

  const panelSubtitle =
    activeKey === "capas" ? (
      <>Import TXT de capas (dry-run / commit) por proyecto.</>
    ) : activeKey === "pozoCapa" ? (
      <>
        Import TXT tabular Pozo-Capa (mapeo + selección + tabla virtualizada).
        Dry-run valida TODAS las filas seleccionadas contra la DB.
      </>
    ) : activeKey === "escenarios" ? (
      <>
        Misma lógica que Pozo-Capa: TXT tabular, mapping, selección, validación
        contra DB y commit sólo si todas las filas quedan resueltas.
      </>
    ) : activeKey === "setEstadoPozos" ? (
      <>
        Import tabular de set de estado de pozos (pozo/capa/fecha/estado) con validacion contra DB y commit parcial.
      </>
    ) : activeKey === "maps" ? (
      <>Import de mapas por filas (pegá JSON del payload) (dry-run / commit).</>
    ) : activeKey === "database" ? (
      <>Últimos resultados del dry-run y del commit.</>
    ) : (
      <>Formato esperado según el tipo de importación.</>
    );

  const canRunCapas = !!proyectoId && !!capasTxt.trim() && !isRunning;
  const canRunMaps = !!proyectoId && !!mapsJson.trim() && !isRunning;

  const pcMappingErrors = pozoCapaImport.mappingErrors?.length ?? 0;
  const pcRowErrors = Object.keys(pozoCapaImport.rowErrors ?? {}).length;

  const canRunPozoCapa =
    !!proyectoId &&
    !!pozoCapaFile &&
    !isRunning &&
    pcMappingErrors === 0 &&
    pcRowErrors === 0;

  const scMappingErrors = scenarioImport.mappingErrors?.length ?? 0;
  const scRowErrors = Object.keys(scenarioImport.rowErrors ?? {}).length;

  const canRunEscenarios =
    !!proyectoId &&
    !!scenarioFile &&
    !!scenarioNombre.trim() &&
    !isRunning &&
    scMappingErrors === 0 &&
    scRowErrors === 0;

  const setMappingErrors = setEstadoPozosImport.mappingErrors?.length ?? 0;
  const setRowErrors = Object.keys(setEstadoPozosImport.rowErrors ?? {}).length;

  const canRunSetEstadoPozos =
    !!proyectoId &&
    !!setEstadoPozosFile &&
    !!setEstadoPozosNombre.trim() &&
    !isRunning &&
    setMappingErrors === 0 &&
    setRowErrors === 0;

  const canRun =
    kind === "capas"
      ? canRunCapas
      : kind === "maps"
        ? canRunMaps
        : kind === "escenarios"
          ? canRunEscenarios
          : kind === "setEstadoPozos"
            ? canRunSetEstadoPozos
            : canRunPozoCapa;

  const computePozoCapaReportWithCols = async (): Promise<{
    report: PozoCapaResolveReport;
    colPozo: number;
    colCapa: number;
    colTope: number;
    colBase: number;
  }> => {
    if (!proyectoId) throw new Error("No hay proyecto seleccionado.");

    const okLocal = validateImport("PozoCapa");
    if (!okLocal) {
      throw new Error(
        "Pozo-Capa: hay errores de mapping o filas inválidas. Corregí antes de validar contra DB.",
      );
    }

    const st = pozoCapaImport;
    const effMapping = st.mapping.map((m: string, i: number) =>
      st.selectedCols[i] ? m : "__ignore__",
    );
    const colPozo = effMapping.findIndex((m: string) => m === "pozo");
    const colCapa = effMapping.findIndex((m: string) => m === "capa");
    const colTope = effMapping.findIndex((m: string) => m === "tope");
    const colBase = effMapping.findIndex((m: string) => m === "base");

    if (colPozo < 0 || colCapa < 0 || colTope < 0 || colBase < 0) {
      throw new Error("Pozo-Capa: mapping incompleto (pozo/capa/tope/base).");
    }

    const [pozos, capas] = await Promise.all([
      window.electron.corePozoListByProject({ proyectoId } as any),
      window.electron.coreCapaListByProject({ proyectoId } as any),
    ]);

    const pozoEntities: NameEntity[] = (pozos ?? []).map((p: any) => ({
      id: String(p.id),
      nombre: String(p.nombre ?? ""),
    }));
    const capaEntities: NameEntity[] = (capas ?? []).map((c: any) => ({
      id: String(c.id),
      nombre: String(c.nombre ?? ""),
    }));

    const pozoIndex = buildResolverIndex(pozoEntities);
    const capaIndex = buildResolverIndex(capaEntities);

    const report = resolvePozoCapaRows({
      rows: st.rows,
      selectedRows: st.selectedRows,
      colPozo,
      colCapa,
      colTope,
      colBase,
      pozoIndex,
      capaIndex,
    });

    return { report, colPozo, colCapa, colTope, colBase };
  };

  const buildPozoCapaInvalidCellsMap = (
    report: PozoCapaResolveReport,
    colPozo: number,
    colCapa: number,
    colTope: number,
    colBase: number,
  ): InvalidCellsMap => {
    const invalid: InvalidCellsMap = {};

    for (const x of report.missingPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "missing";
    }
    for (const x of report.ambiguousPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "ambiguous";
    }
    for (const x of report.missingCapas ?? []) {
      invalid[`${x.rowIndex}:${colCapa}`] = "missing";
    }
    for (const x of report.ambiguousCapas ?? []) {
      invalid[`${x.rowIndex}:${colCapa}`] = "ambiguous";
    }
    for (const x of report.invalidDepth ?? []) {
      invalid[`${x.rowIndex}:${colTope}`] = "invalid";
      invalid[`${x.rowIndex}:${colBase}`] = "invalid";
    }

    return invalid;
  };

  const setEstadoApply = (
    updater: (prev: SetEstadoImportState) => SetEstadoImportState,
  ) => {
    setSetEstadoPozosImport((prev) => recomputeSetEstadoImportState(updater(prev)));
  };

  const loadSetEstadoFromContent = (content: string) => {
    const parsed = parseSetEstadoTabularTxt(content);
    const selectedCols = parsed.columns.map(() => true);
    const selectedRows = parsed.rows.map(() => true);
    const mapping = autoMappingSetEstado(parsed.columns);

    const next: SetEstadoImportState = {
      contentRaw: content,
      columns: parsed.columns,
      columnUnits: parsed.columnUnits,
      rows: uppercaseSetPozoCells(parsed.rows, mapping),
      selectedCols,
      selectedRows,
      mapping,
      rowErrors: {},
      mappingErrors: [],
    };

    setSetEstadoPozosImport(recomputeSetEstadoImportState(next));
    setSetEstadoPozosReport(null);
    setSetEstadoPozosViewMode("all");
    setSetEstadoPozosInvalidCells({});
  };

  const computeSetEstadoReportWithCols = async (): Promise<{
    report: SetEstadoResolveReport;
    colPozo: number;
    colCapa: number;
    colFecha: number;
    colEstado: number;
  }> => {
    if (!proyectoId) throw new Error("No hay proyecto seleccionado.");

    const st = recomputeSetEstadoImportState(setEstadoPozosImport);
    setSetEstadoPozosImport(st);

    if (st.mappingErrors.length > 0 || Object.keys(st.rowErrors).length > 0) {
      throw new Error(
        "Set Estado Pozos: hay errores de mapping o filas invalidas. Corregi antes de validar contra DB.",
      );
    }

    const eff = effectiveSetMapping(st.mapping, st.selectedCols);
    const colPozo = eff.findIndex((m) => m === "pozo");
    const colCapa = eff.findIndex((m) => m === "capa");
    const colFecha = eff.findIndex((m) => m === "fecha");
    const colEstado = eff.findIndex((m) => m === "estado");

    if (colPozo < 0 || colCapa < 0 || colFecha < 0 || colEstado < 0) {
      throw new Error("Set Estado Pozos: mapping incompleto (pozo/capa/fecha/estado).");
    }

    const [pozos, capas] = await Promise.all([
      window.electron.corePozoListByProject({ proyectoId } as any),
      window.electron.coreCapaListByProject({ proyectoId } as any),
    ]);

    const pozoIndex = buildResolverIndex(
      (pozos ?? []).map((p: any) => ({ id: String(p.id), nombre: String(p.nombre ?? "") })),
    );
    const capaIndex = buildResolverIndex(
      (capas ?? []).map((c: any) => ({ id: String(c.id), nombre: String(c.nombre ?? "") })),
    );

    const report: SetEstadoResolveReport = {
      ok: true,
      totalSelected: 0,
      resolved: 0,
      missingPozos: [],
      missingCapas: [],
      ambiguousPozos: [],
      ambiguousCapas: [],
      invalidFechas: [],
      invalidEstados: [],
      unresolvedRowIndices: [],
      rows: [],
    };

    const unresolved = new Set<number>();
    const seenPozoIds = new Set<string>();

    for (let rowIndex = 0; rowIndex < st.rows.length; rowIndex += 1) {
      if (!st.selectedRows[rowIndex]) continue;
      report.totalSelected += 1;

      const r = st.rows[rowIndex];
      const pozoName = cleanImportCell(r.cells[colPozo] ?? "").toUpperCase();
      const capaName = cleanImportCell(r.cells[colCapa] ?? "");
      const fechaRaw = cleanImportCell(r.cells[colFecha] ?? "");
      const estado = cleanImportCell(r.cells[colEstado] ?? "");
      const fecha = normalizeScenarioDate(fechaRaw);

      if (!pozoName) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingPozos.push({ rowIndex, rowNumber: r.rowNumber, pozoName: "" });
        continue;
      }

      if (!capaName) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingCapas.push({ rowIndex, rowNumber: r.rowNumber, capaName: "" });
        continue;
      }

      if (!fecha) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.invalidFechas.push({ rowIndex, rowNumber: r.rowNumber, fecha: fechaRaw });
        continue;
      }

      if (!estado) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.invalidEstados.push({ rowIndex, rowNumber: r.rowNumber, estado: "", reason: "Estado requerido" });
        continue;
      }

      const rp = resolveNameToId(pozoIndex, pozoName);
      if (!rp.ok) {
        report.ok = false;
        unresolved.add(rowIndex);
        if (rp.reason === "missing") {
          report.missingPozos.push({ rowIndex, rowNumber: r.rowNumber, pozoName });
        } else {
          report.ambiguousPozos.push({ rowIndex, rowNumber: r.rowNumber, pozoName, candidates: rp.candidates });
        }
        continue;
      }

      const rc = resolveNameToId(capaIndex, capaName);
      if (!rc.ok) {
        report.ok = false;
        unresolved.add(rowIndex);
        if (rc.reason === "missing") {
          report.missingCapas.push({ rowIndex, rowNumber: r.rowNumber, capaName });
        } else {
          report.ambiguousCapas.push({ rowIndex, rowNumber: r.rowNumber, capaName, candidates: rc.candidates });
        }
        continue;
      }

      if (seenPozoIds.has(rp.id)) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.invalidEstados.push({
          rowIndex,
          rowNumber: r.rowNumber,
          estado,
          reason: "Pozo duplicado en set",
        });
        continue;
      }
      seenPozoIds.add(rp.id);

      report.resolved += 1;
      report.rows.push({
        rowIndex,
        rowNumber: r.rowNumber,
        pozoId: rp.id,
        capaId: rc.id,
        fecha,
        estado,
      });
    }

    report.unresolvedRowIndices = Array.from(unresolved.values());
    return { report, colPozo, colCapa, colFecha, colEstado };
  };

  const buildSetEstadoInvalidCellsMap = (
    report: SetEstadoResolveReport,
    colPozo: number,
    colCapa: number,
    colFecha: number,
    colEstado: number,
  ): InvalidCellsMap => {
    const invalid: InvalidCellsMap = {};

    for (const x of report.missingPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "missing";
    }
    for (const x of report.ambiguousPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "ambiguous";
    }
    for (const x of report.missingCapas ?? []) {
      invalid[`${x.rowIndex}:${colCapa}`] = "missing";
    }
    for (const x of report.ambiguousCapas ?? []) {
      invalid[`${x.rowIndex}:${colCapa}`] = "ambiguous";
    }
    for (const x of report.invalidFechas ?? []) {
      invalid[`${x.rowIndex}:${colFecha}`] = "invalid";
    }
    for (const x of report.invalidEstados ?? []) {
      invalid[`${x.rowIndex}:${colEstado}`] = "invalid";
    }

    return invalid;
  };
  const computeScenarioReportWithCols = async (): Promise<{
    report: ScenarioResolveReport;
    colPozo: number;
    colCapa: number;
  }> => {
    if (!proyectoId) throw new Error("No hay proyecto seleccionado.");

    const okLocal = validateImport("Escenario");
    if (!okLocal) {
      throw new Error(
        "Escenarios: hay errores de mapping o filas inválidas. Corregí antes de validar contra DB.",
      );
    }

    const st = scenarioImport;
    const effMapping = st.mapping.map((m: string, i: number) =>
      st.selectedCols[i] ? m : "__ignore__",
    );

    const colPozo = effMapping.findIndex((m: string) => m === "pozo");
    const colCapa = effMapping.findIndex((m: string) => m === "capa");
    const colFecha = effMapping.findIndex((m: string) => m === "fecha");
    const colPetroleo = effMapping.findIndex((m: string) => m === "petroleo");
    const colAgua = effMapping.findIndex((m: string) => m === "agua");
    const colGas = effMapping.findIndex((m: string) => m === "gas");
    const colInyGas = effMapping.findIndex((m: string) => m === "inyeccionGas");
    const colInyAgua = effMapping.findIndex(
      (m: string) => m === "inyeccionAgua",
    );

    if (colPozo < 0 || colFecha < 0) {
      throw new Error(
        "Escenarios: mapping incompleto. Se requiere al menos pozo y fecha.",
      );
    }

    if (
      colPetroleo < 0 &&
      colAgua < 0 &&
      colGas < 0 &&
      colInyGas < 0 &&
      colInyAgua < 0
    ) {
      throw new Error(
        "Escenarios: debés mapear al menos una métrica (petroleo/agua/gas/inyeccionGas/inyeccionAgua).",
      );
    }

    if (scenarioTipoEscenarioId === "datos" && colCapa < 0) {
      throw new Error(
        'Escenarios tipo "datos": debés mapear una columna a "capa".',
      );
    }

    if (scenarioTipoEscenarioId === "historia" && colCapa >= 0) {
      throw new Error(
        'Escenarios tipo "historia": la columna "capa" debe quedar ignorada.',
      );
    }

    const [pozos, capas] = await Promise.all([
      window.electron.corePozoListByProject({ proyectoId } as any),
      window.electron.coreCapaListByProject({ proyectoId } as any),
    ]);

    const pozoEntities: NameEntity[] = (pozos ?? []).map((p: any) => ({
      id: String(p.id),
      nombre: String(p.nombre ?? ""),
    }));
    const capaEntities: NameEntity[] = (capas ?? []).map((c: any) => ({
      id: String(c.id),
      nombre: String(c.nombre ?? ""),
    }));

    const pozoIndex = buildResolverIndex(pozoEntities);
    const capaIndex = buildResolverIndex(capaEntities);

    const report: ScenarioResolveReport = {
      ok: true,
      totalSelected: 0,
      resolved: 0,

      missingPozos: [],
      missingCapas: [],
      ambiguousPozos: [],
      ambiguousCapas: [],
      invalidFechas: [],
      missingMetrics: [],
      duplicateLogicalRows: [],

      unresolvedRowIndices: [],
      rows: [],
    };

    const unresolved = new Set<number>();
    const logicalKeys = new Set<string>();

    for (let rowIndex = 0; rowIndex < st.rows.length; rowIndex += 1) {
      if (!st.selectedRows[rowIndex]) continue;

      report.totalSelected += 1;

      const r = st.rows[rowIndex];
      const pozoName = (r.cells[colPozo] ?? "").trim();
      const capaName = colCapa >= 0 ? (r.cells[colCapa] ?? "").trim() : "";
      const fechaRaw = (r.cells[colFecha] ?? "").trim();
      const fecha = normalizeScenarioDate(fechaRaw);

      if (!pozoName) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingPozos.push({
          rowIndex,
          rowNumber: r.rowNumber,
          pozoName: "",
        });
        continue;
      }

      if (scenarioTipoEscenarioId === "datos" && !capaName) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingCapas.push({
          rowIndex,
          rowNumber: r.rowNumber,
          capaName: "",
        });
        continue;
      }

      if (!fecha) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.invalidFechas.push({
          rowIndex,
          rowNumber: r.rowNumber,
          fecha: fechaRaw,
        });
        continue;
      }

      const petroleo =
        colPetroleo >= 0
          ? parseNullableMetric(r.cells[colPetroleo] ?? "")
          : null;
      const agua =
        colAgua >= 0 ? parseNullableMetric(r.cells[colAgua] ?? "") : null;
      const gas =
        colGas >= 0 ? parseNullableMetric(r.cells[colGas] ?? "") : null;
      const inyeccionGas =
        colInyGas >= 0 ? parseNullableMetric(r.cells[colInyGas] ?? "") : null;
      const inyeccionAgua =
        colInyAgua >= 0 ? parseNullableMetric(r.cells[colInyAgua] ?? "") : null;

      const hasAnyMetric =
        petroleo != null ||
        agua != null ||
        gas != null ||
        inyeccionGas != null ||
        inyeccionAgua != null;

      if (!hasAnyMetric) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingMetrics.push({
          rowIndex,
          rowNumber: r.rowNumber,
        });
        continue;
      }

      const rp = resolveNameToId(pozoIndex, pozoName);
      if (!rp.ok) {
        report.ok = false;
        unresolved.add(rowIndex);

        if (rp.reason === "missing") {
          report.missingPozos.push({
            rowIndex,
            rowNumber: r.rowNumber,
            pozoName,
          });
        } else {
          report.ambiguousPozos.push({
            rowIndex,
            rowNumber: r.rowNumber,
            pozoName,
            candidates: rp.candidates,
          });
        }
        continue;
      }

      let capaId: string | null = null;

      if (scenarioTipoEscenarioId === "datos") {
        const rc = resolveNameToId(capaIndex, capaName);
        if (!rc.ok) {
          report.ok = false;
          unresolved.add(rowIndex);

          if (rc.reason === "missing") {
            report.missingCapas.push({
              rowIndex,
              rowNumber: r.rowNumber,
              capaName,
            });
          } else {
            report.ambiguousCapas.push({
              rowIndex,
              rowNumber: r.rowNumber,
              capaName,
              candidates: rc.candidates,
            });
          }
          continue;
        }

        capaId = rc.id;
      }

      const logicalKey = buildScenarioLogicalKey(
        scenarioTipoEscenarioId,
        rp.id,
        fecha,
        capaId,
      );

      if (logicalKeys.has(logicalKey)) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.duplicateLogicalRows.push({
          rowIndex,
          rowNumber: r.rowNumber,
        });
        continue;
      }

      logicalKeys.add(logicalKey);

      report.resolved += 1;
      report.rows.push({
        rowIndex,
        rowNumber: r.rowNumber,
        pozoId: rp.id,
        capaId,
        fecha,
        petroleo,
        agua,
        gas,
        inyeccionGas,
        inyeccionAgua,
      });
    }

    report.unresolvedRowIndices = Array.from(unresolved.values());
    return { report, colPozo, colCapa };
  };

  const buildScenarioInvalidCellsMap = (
    report: ScenarioResolveReport,
    colPozo: number,
    colCapa: number,
  ): InvalidCellsMap => {
    const invalid: InvalidCellsMap = {};

    for (const x of report.missingPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "missing";
    }
    for (const x of report.ambiguousPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "ambiguous";
    }

    if (colCapa >= 0) {
      for (const x of report.missingCapas ?? []) {
        invalid[`${x.rowIndex}:${colCapa}`] = "missing";
      }
      for (const x of report.ambiguousCapas ?? []) {
        invalid[`${x.rowIndex}:${colCapa}`] = "ambiguous";
      }
    }

    return invalid;
  };

  const handleDryRun = async () => {
    setError(null);
    setProgress(buildInitialProgress(kind));

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      updateProgress({
        phase: "error",
        message: "No hay proyecto seleccionado.",
      });
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastDryRun(null);

      if (kind === "capas") {
        updateProgress({
          kind,
          phase: "dry-run",
          current: 0,
          total: 0,
          message: "Ejecutando dry-run de capas...",
        });

        const res = await window.electron.importCapasDryRun({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastDryRun(res);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Dry-run de capas finalizado.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "maps") {
        updateProgress({
          kind,
          phase: "preparing",
          current: 0,
          total: 0,
          message: "Validando JSON de maps...",
        });

        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          updateProgress({
            kind,
            phase: "error",
            message: "El JSON de Maps es inválido.",
          });
          return;
        }

        updateProgress({
          kind,
          phase: "dry-run",
          current: 0,
          total: 0,
          message: "Ejecutando dry-run de maps...",
        });

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsDryRun(payload as any);

        setLastDryRun(res);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Dry-run de maps finalizado.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "escenarios") {
        updateProgress({
          kind,
          phase: "validating",
          current: 0,
          total: 0,
          message: "Validando filas de escenario contra la DB...",
        });

        const { report, colPozo, colCapa } =
          await computeScenarioReportWithCols();
        setScenarioReport(report);
        setScenarioInvalidCells(
          buildScenarioInvalidCellsMap(report, colPozo, colCapa),
        );

        if (!report.ok) {
          setScenarioViewMode("unresolved");
          setLastDryRun({
            status: "failed",
            kind: "escenarios",
            rowsTotal: scenarioImport.rows.length,
            rowsSelected:
              scenarioImport.selectedRows?.filter(Boolean).length ?? 0,
            resolved: report.resolved,
            totalSelected: report.totalSelected,
            unresolved: report.unresolvedRowIndices.length,
            missingPozos: report.missingPozos.slice(0, 20),
            missingCapas: report.missingCapas.slice(0, 20),
            ambiguousPozos: report.ambiguousPozos.slice(0, 10),
            ambiguousCapas: report.ambiguousCapas.slice(0, 10),
            invalidFechas: report.invalidFechas.slice(0, 20),
            missingMetrics: report.missingMetrics.slice(0, 20),
            duplicateLogicalRows: report.duplicateLogicalRows.slice(0, 20),
          });
          updateProgress({
            kind,
            phase: "error",
            current: report.resolved,
            total: report.totalSelected,
            message: `Validación con errores: ${report.resolved}/${report.totalSelected} filas resueltas.`,
          });
          setActiveKey("database");
          return;
        }

        updateProgress({
          kind,
          phase: "dry-run",
          current: report.resolved,
          total: report.totalSelected,
          message: "Ejecutando dry-run del escenario...",
        });

        const content = buildContentForCommit("Escenario");
        const res = await window.electron.importEscenariosDryRun({
          proyectoId,
          tipoEscenarioId: scenarioTipoEscenarioId,
          nombreEscenario: scenarioNombre.trim(),
          content,
        });

        setLastDryRun(res);
        updateProgress({
          kind,
          phase: "done",
          current: report.totalSelected,
          total: report.totalSelected,
          message: "Dry-run de escenario finalizado.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "setEstadoPozos") {
        if (setEstadoPozosLargeFilePath) {
          setLastDryRun({
            status: "ok",
            kind: "setEstadoPozos",
            rowsTotal: setEstadoPozosImport.rows.length,
            rowsSelected: setEstadoPozosImport.selectedRows?.filter(Boolean).length ?? 0,
            note: "Archivo grande en modo preview. El Commit procesa el archivo completo.",
          });
          updateProgress({
            kind,
            phase: "done",
            current: setEstadoPozosImport.rows.length,
            total: setEstadoPozosImport.rows.length,
            message:
              "Dry-run en modo preview completado. El Commit correra en backend sobre el archivo completo.",
          });
          setActiveKey("database");
          return;
        }
        updateProgress({
          kind,
          phase: "validating",
          current: 0,
          total: 0,
          message: "Validando filas de set de estado contra la DB...",
        });

        const { report, colPozo, colCapa, colFecha, colEstado } =
          await computeSetEstadoReportWithCols();
        setSetEstadoPozosReport(report);
        setSetEstadoPozosInvalidCells(
          buildSetEstadoInvalidCellsMap(report, colPozo, colCapa, colFecha, colEstado),
        );

        if (!report.ok) setSetEstadoPozosViewMode("unresolved");

        setLastDryRun({
          status: report.ok ? "ok" : "failed",
          kind: "setEstadoPozos",
          rowsTotal: setEstadoPozosImport.rows.length,
          rowsSelected: setEstadoPozosImport.selectedRows?.filter(Boolean).length ?? 0,
          resolved: report.resolved,
          totalSelected: report.totalSelected,
          unresolved: report.unresolvedRowIndices.length,
          missingPozos: report.missingPozos.slice(0, 20),
          missingCapas: report.missingCapas.slice(0, 20),
          ambiguousPozos: report.ambiguousPozos.slice(0, 10),
          ambiguousCapas: report.ambiguousCapas.slice(0, 10),
          invalidFechas: report.invalidFechas.slice(0, 20),
          invalidEstados: report.invalidEstados.slice(0, 20),
        });

        updateProgress({
          kind,
          phase: report.ok ? "done" : "error",
          current: report.resolved,
          total: report.totalSelected,
          message: report.ok
            ? "Dry-run de Set Estado Pozos finalizado."
            : `Validacion con errores: ${report.resolved}/${report.totalSelected} filas resueltas.`,
        });
        setActiveKey("database");
        return;
      }

      updateProgress({
        kind,
        phase: "validating",
        current: 0,
        total: 0,
        message: "Resolviendo Pozo/Capa contra la DB...",
      });

      const { report, colPozo, colCapa, colTope, colBase } =
        await computePozoCapaReportWithCols();
      setPozoCapaReport(report);
      setPozoCapaInvalidCells(
        buildPozoCapaInvalidCellsMap(report, colPozo, colCapa, colTope, colBase),
      );

      if (!report.ok) setPozoCapaViewMode("unresolved");

      const res = {
        status: report.ok ? "ok" : "failed",
        kind: "pozoCapa",
        rowsTotal: pozoCapaImport.rows.length,
        rowsSelected: pozoCapaImport.selectedRows?.filter(Boolean).length ?? 0,
        resolved: report.resolved,
        totalSelected: report.totalSelected,
        unresolved: report.unresolvedRowIndices.length,
        missingPozos: report.missingPozos.slice(0, 20),
        missingCapas: report.missingCapas.slice(0, 20),
        ambiguousPozos: report.ambiguousPozos.slice(0, 10),
        ambiguousCapas: report.ambiguousCapas.slice(0, 10),
        invalidDepth: report.invalidDepth.slice(0, 20),
      };

      setLastDryRun(res);
      updateProgress({
        kind,
        phase: report.ok ? "done" : "error",
        current: report.resolved,
        total: report.totalSelected,
        message: report.ok
          ? "Dry-run de Pozo-Capa finalizado."
          : `Validación con errores: ${report.resolved}/${report.totalSelected} filas resueltas.`,
      });
      setActiveKey("database");
    } catch (e: any) {
      setEstadoLargeProgressRequestIdRef.current = null;
      const msg = e?.message ?? String(e);
      setError(msg);
      updateProgress({
        kind,
        phase: "error",
        message: msg,
      });
    } finally {
      setEstadoLargeProgressRequestIdRef.current = null;
      setIsRunning(false);
    }
  };

  const handleCommit = async () => {
    setError(null);
    setProgress(buildInitialProgress(kind));

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      updateProgress({
        phase: "error",
        message: "No hay proyecto seleccionado.",
      });
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastCommit(null);

      if (kind === "capas") {
        updateProgress({
          kind,
          phase: "committing",
          current: 0,
          total: 0,
          message: "Importando capas...",
        });

        const res = await window.electron.importCapasCommit({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastCommit(res);
        invalidateCapasCache(proyectoId);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Importación de capas finalizada.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "maps") {
        updateProgress({
          kind,
          phase: "preparing",
          current: 0,
          total: 0,
          message: "Validando JSON de maps...",
        });

        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          updateProgress({
            kind,
            phase: "error",
            message: "El JSON de Maps es inválido.",
          });
          return;
        }

        updateProgress({
          kind,
          phase: "committing",
          current: 0,
          total: 0,
          message: "Importando maps...",
        });

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsCommit(payload as any);

        setLastCommit(res);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Importación de maps finalizada.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "escenarios") {
        updateProgress({
          kind,
          phase: "validating",
          current: 0,
          total: 0,
          message: "Validando filas del escenario...",
        });

        const { report, colPozo, colCapa } =
          await computeScenarioReportWithCols();

        const preCommitInvalidCells = buildScenarioInvalidCellsMap(
          report,
          colPozo,
          colCapa,
        );

        setScenarioReport(report);
        setScenarioInvalidCells(preCommitInvalidCells);

        updateProgress({
          kind,
          phase: "committing",
          current: report.resolved,
          total: report.totalSelected,
          message: "Importando escenario...",
        });

        const scenarioName = scenarioNombre.trim();
        const existingScenarios = await window.electron.scenarioListByProject({
          proyectoId,
        } as any);

        const sameName = (existingScenarios ?? []).find((s: any) => {
          const nombre = String(s?.nombre ?? "").trim().toLowerCase();
          return nombre === scenarioName.toLowerCase();
        });

        let escenarioId = "";

        if (sameName) {
          const existingTipo = String((sameName as any).tipoEscenarioId ?? "");
          if (existingTipo && existingTipo !== scenarioTipoEscenarioId) {
            throw new Error(
              `Ya existe un escenario con nombre "${scenarioName}" pero de otro tipo.`,
            );
          }
          escenarioId = String((sameName as any).id);
        } else {
          const createdScenario = await window.electron.scenarioCreate({
            id: crypto.randomUUID(),
            proyectoId,
            tipoEscenarioId: scenarioTipoEscenarioId,
            nombre: scenarioName,
          } as any);
          escenarioId = String((createdScenario as any).id);
        }

        let created = 0;
        let processed = 0;
        const errors: string[] = [];
        const commitFailedRowIndices = new Set<number>();
        const commitInvalidCells: InvalidCellsMap = {};

        for (const r of report.rows) {
          try {
            await window.electron.scenarioValueCreate({
              id: crypto.randomUUID(),
              escenarioId,
              pozoId: r.pozoId,
              capaId: r.capaId,
              fecha: r.fecha,
              petroleo: r.petroleo,
              agua: r.agua,
              gas: r.gas,
              inyeccionGas: r.inyeccionGas,
              inyeccionAgua: r.inyeccionAgua,
            } as any);
            created += 1;
          } catch (e) {
            commitFailedRowIndices.add(r.rowIndex);
            commitInvalidCells[`${r.rowIndex}:${colPozo}`] = "dbError";
            if (colCapa >= 0) {
              commitInvalidCells[`${r.rowIndex}:${colCapa}`] = "dbError";
            }
            errors.push(
              `Linea ${r.rowNumber}: error creando ValorEscenario (${e instanceof Error ? e.message : "unknown"})`,
            );
          } finally {
            processed += 1;
            updateProgress({
              kind,
              phase: "committing",
              current: processed,
              total: report.rows.length,
              message: `Importando escenario... ${processed}/${report.rows.length}`,
            });
          }
        }

        const unresolvedAfterCommit = new Set<number>(report.unresolvedRowIndices);
        for (const rowIndex of commitFailedRowIndices) {
          unresolvedAfterCommit.add(rowIndex);
        }
        const unresolvedAfterCommitList = Array.from(unresolvedAfterCommit.values()).sort(
          (a, b) => a ?? b,
        );

        const reportAfterCommit: ScenarioResolveReport = {
          ...report,
          ok: unresolvedAfterCommitList.length === 0,
          resolved: report.totalSelected ?? unresolvedAfterCommitList.length,
          unresolvedRowIndices: unresolvedAfterCommitList,
        };

        setScenarioReport(reportAfterCommit);
        setScenarioInvalidCells({
          ...preCommitInvalidCells,
          ...commitInvalidCells,
        });

        const unresolvedByName = report.unresolvedRowIndices.length;
        const unresolvedByCommit = commitFailedRowIndices.size;
        const unresolvedTotal = unresolvedAfterCommitList.length;

        setLastCommit({
          status: unresolvedTotal === 0 ? "ok" : "partial",
          kind: "escenarios",
          escenarioId,
          created,
          totalSelected: report.totalSelected,
          unresolvedByName,
          unresolvedByCommit,
          unresolvedTotal,
          errors: errors.slice(0, 20),
        });

        if (unresolvedTotal > 0) {
          const unresolvedSet = new Set(unresolvedAfterCommitList);
          for (
            let rowIndex = 0;
            rowIndex < scenarioImport.rows.length;
            rowIndex += 1
          ) {
            const isSelected = scenarioImport.selectedRows?.[rowIndex] ?? true;
            if (!isSelected) continue;
            if (!unresolvedSet.has(rowIndex)) {
              setImportRowSelected("Escenario", rowIndex, false);
            }
          }

          setScenarioViewMode("unresolved");
          setActiveKey("escenarios");
          setError(
            `Escenario parcial: creados ${created}/${report.totalSelected}. ` +
              `no validados: ${unresolvedByName}. Error DB: ${unresolvedByCommit}.`,
          );
          updateProgress({
            kind,
            phase: "error",
            current: created,
            total: report.totalSelected,
            message:
              `Commit parcial: ${created}/${report.totalSelected} creados. ` +
              `no validados: ${unresolvedByName}, errores DB: ${unresolvedByCommit}.`,
          });
        } else {
          clearImport("Escenario");
          setScenarioFile(null);
          resetScenarioResolutionState();
          setError(null);

          updateProgress({
            kind,
            phase: "done",
            current: report.totalSelected,
            total: report.totalSelected,
            message: "Importacion del escenario finalizada.",
          });

          setActiveKey("database");
        }

        return;
      }
      if (kind === "setEstadoPozos") {
        if (setEstadoPozosLargeFilePath) {
          if (!proyectoId) {
            throw new Error("No hay proyecto seleccionado.");
          }

          updateProgress({
            kind,
            phase: "committing",
            current: 0,
            total: 0,
            message: "Procesando archivo grande en backend...",
          });

          const requestId = crypto.randomUUID();
          setEstadoLargeProgressRequestIdRef.current = requestId;

          const result = await window.electron.importSetEstadoPozosLargeCommit({
            proyectoId,
            nombreSetEstadoPozos: setEstadoPozosNombre.trim(),
            filePath: setEstadoPozosLargeFilePath,
            requestId,
          } as any);

          setEstadoLargeProgressRequestIdRef.current = null;

          const unresolvedRows = (result?.unresolvedSample ?? []).map((r: any) => ({
            rowNumber: Number(r.rowNumber ?? 0),
            cells: [
              String(r.pozo ?? ""),
              String(r.capa ?? ""),
              String(r.fecha ?? ""),
              String(r.estado ?? ""),
            ],
          }));

          if ((result?.unresolvedRows ?? 0) > 0) {
            const mapping: Array<SetEstadoFieldKey | "__ignore__"> = [
              "pozo",
              "capa",
              "fecha",
              "estado",
            ];

            const unresolvedImport: SetEstadoImportState = recomputeSetEstadoImportState({
              contentRaw: "",
              columns: ["pozo", "capa", "fecha", "estado"],
              columnUnits: ["", "", "", ""],
              rows: unresolvedRows,
              selectedCols: [true, true, true, true],
              selectedRows: unresolvedRows.map(() => true),
              mapping,
              rowErrors: {},
              mappingErrors: [],
            });

            setSetEstadoPozosImport(unresolvedImport);
            setSetEstadoPozosLargeFilePath(null);
            setSetEstadoPozosViewMode("all");
            setSetEstadoPozosInvalidCells({});

            setSetEstadoPozosReport({
              ok: false,
              totalSelected: Number(result?.totalRows ?? 0),
              resolved:
                Number(result?.totalRows ?? 0) -
                Number(result?.unresolvedRows ?? 0),
              missingPozos: [],
              missingCapas: [],
              ambiguousPozos: [],
              ambiguousCapas: [],
              invalidFechas: [],
              invalidEstados: [],
              unresolvedRowIndices: unresolvedRows.map((_: any, idx: number) => idx),
              rows: [],
            });

            const truncated = Boolean(result?.unresolvedSampleTruncated);
            setError(
              `Importacion parcial: ${result?.insertedRows ?? 0}/${result?.totalRows ?? 0} guardadas. ` +
                `no resueltas: ${result?.unresolvedRows ?? 0}. ` +
                (truncated
                  ? "Se muestra una muestra de no resueltas para correccion."
                  : "Corregi y volve a commit para guardar pendientes."),
            );

            updateProgress({
              kind,
              phase: "error",
              current: Number(result?.insertedRows ?? 0),
              total: Number(result?.totalRows ?? 0),
              unit: "rows",
              message:
                `Commit parcial archivo grande: ${result?.insertedRows ?? 0}/${result?.totalRows ?? 0}. ` +
                `Pendientes: ${result?.unresolvedRows ?? 0}.`,
            });

            return;
          }

          setSetEstadoPozosFile(null);
          setSetEstadoPozosLargeFilePath(null);
          setSetEstadoPozosImport(emptySetEstadoImportState());
          resetSetEstadoResolutionState();
          setError(null);

          updateProgress({
            kind,
            phase: "done",
            current: Number(result?.insertedRows ?? 0),
            total: Number(result?.totalRows ?? 0),
            unit: "rows",
            message: `Importacion Set Estado Pozos finalizada. Creadas: ${result?.insertedRows ?? 0}.`,
          });
          setActiveKey("database");
          return;
        }
        updateProgress({
          kind,
          phase: "validating",
          current: 0,
          total: 0,
          message: "Validando set de estado antes del commit...",
        });

        const { report, colPozo, colCapa, colFecha, colEstado } =
          await computeSetEstadoReportWithCols();

        const preCommitInvalidCells = buildSetEstadoInvalidCellsMap(
          report,
          colPozo,
          colCapa,
          colFecha,
          colEstado,
        );

        setSetEstadoPozosReport(report);
        setSetEstadoPozosInvalidCells(preCommitInvalidCells);

        const setNombre = setEstadoPozosNombre.trim();
        const existingSets = await window.electron.wellStateSetListByProject({
          proyectoId,
        } as any);

        const sameNameSet = (existingSets ?? []).find((s: any) => {
          const nombre = String(s?.nombre ?? "").trim().toLowerCase();
          return nombre === setNombre.toLowerCase();
        });

        const setEstadoPozosId = sameNameSet
          ? String((sameNameSet as any).id)
          : String(
              (
                await window.electron.wellStateSetCreate({
                  id: crypto.randomUUID(),
                  proyectoId,
                  simulacionId: null,
                  nombre: setNombre,
                } as any)
              )?.id,
            );

        const types = await window.electron.wellStateTypeList();
        const stateTypeByName = new Map<string, string>();
        for (const t of types ?? []) {
          const key = String((t as any)?.nombre ?? "").trim().toLowerCase();
          if (!key) continue;
          stateTypeByName.set(key, String((t as any).id));
        }

        let created = 0;
        let processed = 0;
        const errors: string[] = [];
        const commitFailedRowIndices = new Set<number>();
        const commitInvalidCells: InvalidCellsMap = {};

        updateProgress({
          kind,
          phase: "committing",
          current: 0,
          total: report.rows.length,
          message: `Importando set de estado... 0/${report.rows.length}`,
        });

        for (const row of report.rows) {
          try {
            const stateName = String(row.estado ?? "").trim();
            const stateKey = stateName.toLowerCase();
            const stateTypeId = stateTypeByName.get(stateKey) ?? "";

            if (!stateTypeId) {
              throw new Error(`Tipo de estado no permitido: ${stateName}`);
            }

            await window.electron.wellStateSetDetailCreate({
              id: crypto.randomUUID(),
              setEstadoPozosId,
              pozoId: row.pozoId,
              capaId: row.capaId,
              fecha: row.fecha,
              tipoEstadoPozoId: stateTypeId,
            } as any);
            created += 1;
          } catch (e) {
            commitFailedRowIndices.add(row.rowIndex);
            commitInvalidCells[`${row.rowIndex}:${colPozo}`] = "dbError";
            commitInvalidCells[`${row.rowIndex}:${colCapa}`] = "dbError";
            commitInvalidCells[`${row.rowIndex}:${colFecha}`] = "dbError";
            commitInvalidCells[`${row.rowIndex}:${colEstado}`] = "dbError";
            errors.push(
              `Linea ${row.rowNumber}: error creando SetEstadoPozosDetalle (${e instanceof Error ? e.message : "unknown"})`,
            );
          } finally {
            processed += 1;
            updateProgress({
              kind,
              phase: "committing",
              current: processed,
              total: report.rows.length,
              message: `Importando set de estado... ${processed}/${report.rows.length}`,
            });
          }
        }

        const unresolvedAfterCommit = new Set<number>(report.unresolvedRowIndices);
        for (const rowIndex of commitFailedRowIndices) {
          unresolvedAfterCommit.add(rowIndex);
        }
        const unresolvedAfterCommitList = Array.from(unresolvedAfterCommit.values()).sort(
          (a, b) => a ?? b,
        );

        const reportAfterCommit: SetEstadoResolveReport = {
          ...report,
          ok: unresolvedAfterCommitList.length === 0,
          resolved: report.totalSelected ?? unresolvedAfterCommitList.length,
          unresolvedRowIndices: unresolvedAfterCommitList,
        };

        setSetEstadoPozosReport(reportAfterCommit);
        setSetEstadoPozosInvalidCells({
          ...preCommitInvalidCells,
          ...commitInvalidCells,
        });

        const unresolvedByName = report.unresolvedRowIndices.length;
        const unresolvedByCommit = commitFailedRowIndices.size;
        const unresolvedTotal = unresolvedAfterCommitList.length;

        setLastCommit({
          status: unresolvedTotal === 0 ? "ok" : "partial",
          kind: "setEstadoPozos",
          setEstadoPozosId,
          created,
          totalSelected: report.totalSelected,
          unresolvedByName,
          unresolvedByCommit,
          unresolvedTotal,
          errors: errors.slice(0, 20),
        });

        if (unresolvedTotal > 0) {
          const unresolvedSet = new Set(unresolvedAfterCommitList);
          setEstadoApply((prev) => ({
            ...prev,
            selectedRows: prev.selectedRows.map((selected, rowIndex) =>
              selected ? unresolvedSet.has(rowIndex) : false,
            ),
          }));

          setSetEstadoPozosViewMode("unresolved");
          setActiveKey("setEstadoPozos");
          setError(
            `Set Estado Pozos parcial: creados ${created}/${report.totalSelected}. ` +
              `no validados: ${unresolvedByName}. Error DB: ${unresolvedByCommit}.`,
          );
          updateProgress({
            kind,
            phase: "error",
            current: created,
            total: report.totalSelected,
            message:
              `Commit parcial: ${created}/${report.totalSelected} creados. ` +
              `no validados: ${unresolvedByName}, errores DB: ${unresolvedByCommit}.`,
          });
        } else {
          setSetEstadoPozosFile(null);
          setSetEstadoPozosImport(emptySetEstadoImportState());
          resetSetEstadoResolutionState();
          setError(null);
          updateProgress({
            kind,
            phase: "done",
            current: report.totalSelected,
            total: report.totalSelected,
            message: `Importacion Set Estado Pozos finalizada. Creados: ${created}.`,
          });
          setActiveKey("database");
        }

        return;
      }

      updateProgress({
        kind,
        phase: "validating",
        current: 0,
        total: 0,
        message: "Validando Pozo-Capa antes del commit...",
      });

      const { report, colPozo, colCapa, colTope, colBase } =
        await computePozoCapaReportWithCols();
      const preCommitInvalidCells = buildPozoCapaInvalidCellsMap(
        report,
        colPozo,
        colCapa,
        colTope,
        colBase,
      );
      setPozoCapaReport(report);
      setPozoCapaInvalidCells(preCommitInvalidCells);

      let created = 0;
      let processed = 0;
      const errors: string[] = [];
      const commitFailedRowIndices = new Set<number>();
      const commitInvalidCells: InvalidCellsMap = {};

      updateProgress({
        kind,
        phase: "committing",
        current: 0,
        total: report.rows.length,
        message: `Creando relaciones Pozo-Capa... 0/${report.rows.length}`,
      });

      for (const r of report.rows) {
        try {
          await window.electron.corePozoCapaCreate({
            id: crypto.randomUUID(),
            proyectoId,
            pozoId: r.pozoId,
            capaId: r.capaId,
            tope: r.tope,
            base: r.base,
          } as any);
          created += 1;
        } catch (e) {
          commitFailedRowIndices.add(r.rowIndex);
          commitInvalidCells[`${r.rowIndex}:${colTope}`] = "dbError";
          commitInvalidCells[`${r.rowIndex}:${colBase}`] = "dbError";
          errors.push(
            `Linea ${r.rowNumber}: error creando PozoCapa (${e instanceof Error ? e.message : "unknown"})`,
          );
        } finally {
          processed += 1;
          updateProgress({
            kind,
            phase: "committing",
            current: processed,
            total: report.rows.length,
            message: `Creando relaciones Pozo-Capa... ${processed}/${report.rows.length}`,
          });
        }
      }

      const unresolvedAfterCommit = new Set<number>(report.unresolvedRowIndices);
      for (const rowIndex of commitFailedRowIndices) {
        unresolvedAfterCommit.add(rowIndex);
      }
      const unresolvedAfterCommitList = Array.from(unresolvedAfterCommit.values()).sort(
        (a, b) => a ?? b,
      );

      const reportAfterCommit: PozoCapaResolveReport = {
        ...report,
        ok: unresolvedAfterCommitList.length === 0,
        resolved: report.totalSelected ?? unresolvedAfterCommitList.length,
        unresolvedRowIndices: unresolvedAfterCommitList,
      };

      setPozoCapaReport(reportAfterCommit);
      setPozoCapaInvalidCells({
        ...preCommitInvalidCells,
        ...commitInvalidCells,
      });

      const unresolvedByName = report.unresolvedRowIndices.length;
      const unresolvedByCommit = commitFailedRowIndices.size;
      const unresolvedTotal = unresolvedAfterCommitList.length;

      setLastCommit({
        status: unresolvedTotal === 0 ? "ok" : "partial",
        kind: "pozoCapa",
        created,
        totalSelected: report.totalSelected,
        unresolvedByName,
        unresolvedByCommit,
        unresolvedTotal,
        errors: errors.slice(0, 20),
      });

      if (unresolvedTotal > 0) {
        const unresolvedSet = new Set(unresolvedAfterCommitList);
        for (let rowIndex = 0; rowIndex < pozoCapaImport.rows.length; rowIndex += 1) {
          const isSelected = pozoCapaImport.selectedRows?.[rowIndex] ?? true;
          if (!isSelected) continue;
          if (!unresolvedSet.has(rowIndex)) {
            setImportRowSelected("PozoCapa", rowIndex, false);
          }
        }

        setPozoCapaViewMode("unresolved");
        setActiveKey("pozoCapa");
        setError(
          `Pozo-Capa parcial: creados ${created}/${report.totalSelected}. ` +
            `no validados: ${unresolvedByName}. Error DB: ${unresolvedByCommit}.`,
        );
        updateProgress({
          kind,
          phase: "error",
          current: created,
          total: report.totalSelected,
          message:
            `Commit parcial: ${created}/${report.totalSelected} creados. ` +
            `no validados: ${unresolvedByName}, errores DB: ${unresolvedByCommit}.`,
        });
      } else {
        clearImport("PozoCapa");
        setPozoCapaFile(null);
        setPozoCapaViewMode("all");
        setPozoCapaReport(null);
        setPozoCapaInvalidCells({});
        setError(null);
        updateProgress({
          kind,
          phase: "done",
          current: report.totalSelected,
          total: report.totalSelected,
          message: `Importacion Pozo-Capa finalizada. Creados: ${created}.`,
        });
        setActiveKey("database");
      }
    } catch (e: any) {
      setEstadoLargeProgressRequestIdRef.current = null;
      const msg = e?.message ?? String(e);
      setError(msg);
      updateProgress({
        kind,
        phase: "error",
        message: msg,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    resetProgressState();
    onClose();
  };

  const scenarioFieldOptions = useMemo(
    () => scenarioFieldOptionsForType(scenarioTipoEscenarioId),
    [scenarioTipoEscenarioId],
  );

  const progressPercent = getProgressPercent(progress);

  return (
    <OptionsShellModal<TabKey>
      isOpen={isOpen}
      title="Importar"
      onClose={handleClose}
      items={items}
      activeKey={activeKey}
      onChangeKey={setActiveKey}
      widthClassName="osm__wFull"
      heightClassName="osm__hFull"
      sidebarWidthClassName="osm__gridFull"
      panelTitle={panelTitle}
      panelSubtitle={panelSubtitle}
      footer={
        <div className="importModal__footer">
          <button
            className="osm__footerBtn"
            onClick={handleClose}
            type="button"
          >
            Cerrar
          </button>

          <div style={{ flex: 1 }} />

          {activeKey === "capas" ||
          activeKey === "maps" ||
          activeKey === "pozoCapa" ||
          activeKey === "escenarios" ||
          activeKey === "setEstadoPozos" ? (
            <>
              <button
                className="osm__footerBtn"
                onClick={handleDryRun}
                type="button"
                disabled={!canRun}
                title={!proyectoId ? "Seleccioná un proyecto" : undefined}
              >
                {isRunning ? "Ejecutando..." : "Dry-run"}
              </button>

              <button
                className="osm__footerBtn"
                onClick={handleCommit}
                type="button"
                disabled={!canRun}
                title={!proyectoId ? "Seleccioná un proyecto" : undefined}
              >
                {isRunning ? "Ejecutando..." : "Commit"}
              </button>
            </>
          ) : null}
        </div>
      }
    >
      {progress?.visible ? (
        <div className="importModal__progress">
          <div className="importModal__progressTop">
            <div className="importModal__progressMessage">
              {progress.message}
            </div>
            <div className="importModal__progressMeta">
              {progress.total > 0
                ? progress.unit === "bytes"
                  ? `${formatBytes(progress.current)} / ${formatBytes(progress.total)} � ${progressPercent}%`
                  : `${progress.current}/${progress.total} � ${progressPercent}%`
                : progress.phase}
            </div>
          </div>

          <div className="importModal__progressBar">
            <div
              className={`importModal__progressFill importModal__progressFill--${progress.phase}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {activeKey === "capas" ? (
        <CapasTab
          proyectoId={proyectoId}
          value={capasTxt}
          setValue={setCapasTxt}
          isRunning={isRunning}
          error={error}
        />
      ) : null}

      {activeKey === "pozoCapa" ? (
        <PozoCapaTab
          proyectoId={proyectoId}
          file={pozoCapaFile}
          setFile={setPozoCapaFile}
          importState={pozoCapaImport}
          isRunning={isRunning}
          error={error}
          onLoadContent={async (f) => {
            if (!f) {
              clearImport("PozoCapa");
              setPozoCapaReport(null);
              setPozoCapaViewMode("all");
              setPozoCapaInvalidCells({});
              return;
            }
            try {
              setError(null);
              const text = await readTabularFileText(f);
              setImportFromContent("PozoCapa", text);
              setPozoCapaReport(null);
              setPozoCapaViewMode("all");
              setPozoCapaInvalidCells({});
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "No se pudo leer el archivo seleccionado.";
              setError(`no se pudo leer ${f.name}: ${msg}`);
            }
          }}
          onChangeMapping={(col, m) =>
            setImportMapping("PozoCapa", col, m as any)
          }
          onChangeColSelected={(col, sel) =>
            setImportColSelected("PozoCapa", col, sel)
          }
          onChangeAllCols={(sel) => setImportAllColsSelected("PozoCapa", sel)}
          onChangeRowSelected={(row, sel) =>
            setImportRowSelected("PozoCapa", row, sel)
          }
          onChangeAllRows={(sel) => setImportAllRowsSelected("PozoCapa", sel)}
          onChangeCell={(r, c, v) => setImportCell("PozoCapa", r, c, v)}
          viewMode={pozoCapaViewMode}
          setViewMode={setPozoCapaViewMode}
          report={pozoCapaReport}
          invalidCells={pozoCapaInvalidCells}
        />
      ) : null}

      {activeKey === "escenarios" ? (
        <EscenariosTab
          proyectoId={proyectoId}
          tipoEscenarioId={scenarioTipoEscenarioId}
          setTipoEscenarioId={(next) => {
            setScenarioTipoEscenarioId(next);
            resetScenarioResolutionState();
          }}
          nombreEscenario={scenarioNombre}
          setNombreEscenario={setScenarioNombre}
          file={scenarioFile}
          setFile={setScenarioFile}
          importState={scenarioImport}
          isRunning={isRunning}
          error={error}
          fieldOptions={scenarioFieldOptions}
          onLoadContent={async (f) => {
            if (!f) {
              clearImport("Escenario");
              resetScenarioResolutionState();
              return;
            }
            try {
              setError(null);
              const text = await readTabularFileText(f);
              setImportFromContent("Escenario", text);
              resetScenarioResolutionState();
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "No se pudo leer el archivo seleccionado.";
              setError(`no se pudo leer ${f.name}: ${msg}`);
            }
          }}
          onChangeMapping={(col, m) =>
            setImportMapping("Escenario", col, m as any)
          }
          onChangeColSelected={(col, sel) =>
            setImportColSelected("Escenario", col, sel)
          }
          onChangeAllCols={(sel) => setImportAllColsSelected("Escenario", sel)}
          onChangeRowSelected={(row, sel) =>
            setImportRowSelected("Escenario", row, sel)
          }
          onChangeAllRows={(sel) => setImportAllRowsSelected("Escenario", sel)}
          onChangeCell={(r, c, v) => setImportCell("Escenario", r, c, v)}
          viewMode={scenarioViewMode}
          setViewMode={setScenarioViewMode}
          report={scenarioReport}
          invalidCells={scenarioInvalidCells}
          onDeselectUnresolvedRows={() => {
            if (!scenarioReport) return;
            deselectScenarioRows(scenarioReport.unresolvedRowIndices);
          }}
          onDeselectMissingPozos={() => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingPozos.map((x) => x.rowIndex),
            );
          }}
          onDeselectMissingCapas={() => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingCapas.map((x) => x.rowIndex),
            );
          }}
          onDeselectRowsByPozoName={(pozoName) => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingPozos
                .filter((x) => x.pozoName === pozoName)
                .map((x) => x.rowIndex),
            );
          }}
          onDeselectRowsByCapaName={(capaName) => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingCapas
                .filter((x) => x.capaName === capaName)
                .map((x) => x.rowIndex),
            );
          }}
        />
      ) : null}

      {activeKey === "setEstadoPozos" ? (
        <SetEstadoPozosTab
          proyectoId={proyectoId}
          nombreSetEstadoPozos={setEstadoPozosNombre}
          setNombreSetEstadoPozos={setSetEstadoPozosNombre}
          file={setEstadoPozosFile}
          setFile={setSetEstadoPozosFile}
          importState={setEstadoPozosImport}
          isRunning={isRunning}
          error={error}
          onLoadContent={async (f) => {
            if (!f) {
              setSetEstadoPozosImport(emptySetEstadoImportState());
              setSetEstadoPozosReport(null);
              setSetEstadoPozosViewMode("all");
              setSetEstadoPozosInvalidCells({});
              return;
            }
            try {
              setError(null);

              if (f.size > MAX_TABULAR_FILE_BYTES) {
                const filePath = String((f as any)?.path ?? window.electron.getPathForFile(f) ?? "").trim();
                if (!filePath) {
                  throw new Error(
                    "No se pudo obtener la ruta local del archivo para importacion grande.",
                  );
                }

                const previewText = await readTabularFileText(f, {
                  maxBytes: 2 * 1024 * 1024,
                  skipSizeGuard: true,
                });
                const previewState = buildSetEstadoPreviewState(previewText);

                setSetEstadoPozosLargeFilePath(filePath);
                setSetEstadoPozosImport(previewState);
                setSetEstadoPozosReport(null);
                setSetEstadoPozosViewMode("all");
                setSetEstadoPozosInvalidCells({});
                setError(
                  `Archivo grande detectado (${(f.size / (1024 * 1024)).toFixed(1)} MB). Se muestran las primeras ${previewState.rows.length} filas para vista previa; el Commit procesa el archivo completo.`,
                );
                return;
              }

              setSetEstadoPozosLargeFilePath(null);
              const text = await readTabularFileText(f);
              loadSetEstadoFromContent(text);
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "No se pudo leer el archivo seleccionado.";
              setError(`no se pudo leer ${f.name}: ${msg}`);
            }
          }}
          onChangeMapping={(col, m) =>
            setEstadoApply((prev) => {
              const mapping = [...prev.mapping];
              mapping[col] = m as any;
              const rows = uppercaseSetPozoCells(prev.rows, mapping as any);
              return { ...prev, mapping, rows };
            })
          }
          onChangeColSelected={(col, sel) =>
            setEstadoApply((prev) => {
              const selectedCols = [...prev.selectedCols];
              selectedCols[col] = sel;
              return { ...prev, selectedCols };
            })
          }
          onChangeAllCols={(sel) =>
            setEstadoApply((prev) => ({
              ...prev,
              selectedCols: prev.columns.map(() => sel),
            }))
          }
          onChangeRowSelected={(row, sel) =>
            setEstadoApply((prev) => {
              const selectedRows = [...prev.selectedRows];
              selectedRows[row] = sel;
              return { ...prev, selectedRows };
            })
          }
          onChangeAllRows={(sel) =>
            setEstadoApply((prev) => ({
              ...prev,
              selectedRows: prev.rows.map(() => sel),
            }))
          }
          onChangeCell={(r, c, v) =>
            setEstadoApply((prev) => {
              const rows = [...prev.rows];
              const row = rows[r];
              if (!row) return prev;
              const cells = [...row.cells];
              const isPozoCol = prev.mapping[c] === "pozo";
              cells[c] = isPozoCol ? String(v ?? "").toUpperCase() : v;
              rows[r] = { ...row, cells };
              return { ...prev, rows };
            })
          }
          onReplaceValue={(colIndex, fromValue, toValue, rowIndices) => {
            let replaced = 0;
            setEstadoApply((prev) => {
              const rowSet = new Set(rowIndices);
              const rows = prev.rows.map((row, rowIndex) => {
                if (!rowSet.has(rowIndex)) return row;
                const cells = [...row.cells];
                if (String(cells[colIndex] ?? "") !== String(fromValue ?? "")) {
                  return row;
                }
                const isPozoCol = prev.mapping[colIndex] === "pozo";
                cells[colIndex] = isPozoCol
                  ? String(toValue ?? "").toUpperCase()
                  : String(toValue ?? "");
                replaced += 1;
                return { ...row, cells };
              });
              return { ...prev, rows };
            });
            return replaced;
          }}
          viewMode={setEstadoPozosViewMode as any}
          setViewMode={setSetEstadoPozosViewMode as any}
          report={setEstadoPozosReport as any}
          invalidCells={setEstadoPozosInvalidCells}
        />
      ) : null}
      {activeKey === "maps" ? (
        <MapsTab
          proyectoId={proyectoId}
          value={mapsJson}
          setValue={setMapsJson}
          isRunning={isRunning}
          error={error}
        />
      ) : null}

      {activeKey === "database" ? (
        <DatabaseTab
          proyectoId={proyectoId}
          lastKind={lastKind}
          lastDryRun={lastDryRun}
          lastCommit={lastCommit}
          error={error}
        />
      ) : null}

      {activeKey === "help" ? <HelpTab /> : null}
    </OptionsShellModal>
  );
}

function InvalidBulkReplacePanel(props: {
  groups: InvalidBulkReplaceGroup[];
  disabled?: boolean;
  onReplace: (
    colIndex: number,
    fromValue: string,
    toValue: string,
    rowIndices: number[],
  ) => number;
}) {
  const { groups, disabled, onReplace } = props;

  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setReplacements({});
    setFeedback(null);
  }, [groups.length]);

  if (groups.length === 0) return null;

  return (
    <div className="importModal__groupSection">
      <div className="importModal__groupTitle">Reemplazo masivo de celdas invalidas</div>

      <div className="importModal__groupList">
        {groups.map((item) => {
          const nextValue = replacements[item.id] ?? "";

          return (
            <div key={item.id} className="importModal__groupItem">
              <div className="importModal__groupLabel">
                <span>{item.colLabel}:</span>
                <code>{item.label}</code>
                <span>({item.count} filas)</span>
              </div>

              <div className="importModal__groupActions">
                <input
                  className="importModal__groupInput"
                  value={nextValue}
                  onChange={(e) =>
                    setReplacements((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                  disabled={disabled}
                  placeholder="Nuevo valor"
                />

                <button
                  type="button"
                  className="osm__footerBtn"
                  disabled={disabled || !nextValue.trim()}
                  onClick={() => {
                    const replaced = onReplace(
                      item.colIndex,
                      item.value,
                      nextValue,
                      item.rowIndices,
                    );

                    setFeedback(
                      replaced > 0
                        ? `Reemplazadas ${replaced} celdas de "${item.label}" en ${item.colLabel}.`
                        : "No hubo celdas para reemplazar.",
                    );
                  }}
                >
                  Reemplazar todas
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {feedback ? <div className="importModal__groupFeedback">{feedback}</div> : null}
    </div>
  );
}
function CapasTab(props: {
  proyectoId: string | null;
  value: string;
  setValue: (v: string) => void;
  isRunning: boolean;
  error: string | null;
}) {
  const { proyectoId, value, setValue, isRunning, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>
        <div style={{ opacity: 0.85 }}>
          Pegá el TXT de capas en el textarea y ejecutá <b>Dry-run</b> o{" "}
          <b>Commit</b>.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">TXT de capas</div>
        <textarea
          className="importModal__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isRunning}
          placeholder="Pegá acá el contenido TXT..."
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function EscenariosTab(props: {
  proyectoId: string | null;
  tipoEscenarioId: string;
  setTipoEscenarioId: (v: string) => void;
  nombreEscenario: string;
  setNombreEscenario: (v: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  importState: any;
  isRunning: boolean;
  error: string | null;
  fieldOptions: Array<{ key: string; label: string }>;
  onLoadContent: (f: File | null) => Promise<void>;
  onChangeMapping: (colIndex: number, mapping: string) => void;
  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;
  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;
  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  viewMode: ScenarioViewMode;
  setViewMode: (m: ScenarioViewMode) => void;
  report: ScenarioResolveReport | null;
  invalidCells: InvalidCellsMap;
  onDeselectUnresolvedRows: () => void;
  onDeselectMissingPozos: () => void;
  onDeselectMissingCapas: () => void;
  onDeselectRowsByPozoName: (pozoName: string) => void;
  onDeselectRowsByCapaName: (capaName: string) => void;
}) {
  const {
    proyectoId,
    tipoEscenarioId,
    setTipoEscenarioId,
    nombreEscenario,
    setNombreEscenario,
    file,
    setFile,
    importState,
    isRunning,
    error,
    fieldOptions,
    onLoadContent,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    viewMode,
    setViewMode,
    report,
    invalidCells,
    onDeselectUnresolvedRows,
    onDeselectMissingPozos,
    onDeselectMissingCapas,
    onDeselectRowsByPozoName,
    onDeselectRowsByCapaName,
  } = props;

  const mappingErrs = importState.mappingErrors?.length ?? 0;
  const rowErrs = Object.keys(importState.rowErrors ?? {}).length;

  const unresolvedRowIndices = useMemo(() => {
    if (!report) return [];
    return report.unresolvedRowIndices;
  }, [report]);

  const missingPozosGrouped = useMemo(() => {
    if (!report) return [];
    return groupRowsByLabel(report.missingPozos, (x) => x.pozoName);
  }, [report]);

  const missingCapasGrouped = useMemo(() => {
    if (!report) return [];
    return groupRowsByLabel(report.missingCapas, (x) => x.capaName);
  }, [report]);

  const rowIndexMap =
    viewMode === "unresolved" && report ? unresolvedRowIndices : null;

  const onChangeAllRowsView = (sel: boolean) => {
    if (!rowIndexMap) {
      onChangeAllRows(sel);
      return;
    }
    for (const idx of rowIndexMap) {
      onChangeRowSelected(idx, sel);
    }
  };

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>

        <div style={{ opacity: 0.85 }}>
          Tipo <b>{tipoEscenarioId}</b>. En <b>datos</b> se exige Pozo + Capa.
          En <b>historia</b> la capa debe quedar ignorada.
        </div>
      </div>

      {report ? (
        <div
          className="importModal__hint"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
          }}
        >
          {report.ok ? (
            <div>
              ✅ Validación OK: <b>{report.resolved}</b> /{" "}
              <b>{report.totalSelected}</b> filas resueltas.
            </div>
          ) : (
            <div className="importModal__resolveBlock">
              <div>
                ❌ Faltan resolver: <b>{report.resolved}</b> /{" "}
                <b>{report.totalSelected}</b> (unresolved:{" "}
                <b>{report.unresolvedRowIndices.length}</b>)
              </div>

              <div className="importModal__resolveActions">
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("unresolved")}
                >
                  Mostrar solo no resueltas
                </button>

                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("all")}
                >
                  Mostrar todas
                </button>

                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={onDeselectUnresolvedRows}
                >
                  Deseleccionar no resueltas
                </button>

                {report.missingPozos.length > 0 ? (
                  <button
                    type="button"
                    className="osm__footerBtn"
                    onClick={onDeselectMissingPozos}
                  >
                    Deseleccionar pozos faltantes
                  </button>
                ) : null}

                {report.missingCapas.length > 0 ? (
                  <button
                    type="button"
                    className="osm__footerBtn"
                    onClick={onDeselectMissingCapas}
                  >
                    Deseleccionar capas faltantes
                  </button>
                ) : null}
              </div>

              {missingPozosGrouped.length > 0 ? (
                <div className="importModal__groupSection">
                  <div className="importModal__groupTitle">
                    Pozos no encontrados
                  </div>

                  <div className="importModal__groupList">
                    {missingPozosGrouped.map((item) => (
                      <div key={item.label} className="importModal__groupItem">
                        <div className="importModal__groupLabel">
                          <code>{item.label}</code>
                          <span>({item.count} filas)</span>
                        </div>

                        <button
                          type="button"
                          className="osm__footerBtn"
                          onClick={() => onDeselectRowsByPozoName(item.label)}
                        >
                          Deseleccionar esas filas
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {missingCapasGrouped.length > 0 ? (
                <div className="importModal__groupSection">
                  <div className="importModal__groupTitle">
                    Capas no encontradas
                  </div>

                  <div className="importModal__groupList">
                    {missingCapasGrouped.map((item) => (
                      <div key={item.label} className="importModal__groupItem">
                        <div className="importModal__groupLabel">
                          <code>{item.label}</code>
                          <span>({item.count} filas)</span>
                        </div>

                        <button
                          type="button"
                          className="osm__footerBtn"
                          onClick={() => onDeselectRowsByCapaName(item.label)}
                        >
                          Deseleccionar esas filas
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="importModal__hint" style={{ opacity: 0.85 }}>
          Igual que Pozo-Capa: subí TXT, mapeá columnas y ejecutá <b>Dry-run</b>{" "}
          para validar todas las filas contra la DB.
        </div>
      )}

      <div className="importModal__box">
        <div className="importModal__boxTitle">Configuración del escenario</div>

        <div className="importModal__row">
          <div className="importModal__label">Tipo</div>
          <select
            className="importModal__select"
            value={tipoEscenarioId}
            onChange={(e) => setTipoEscenarioId(e.target.value)}
            disabled={isRunning}
          >
            {SCENARIO_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="importModal__row">
          <div className="importModal__label">Nombre</div>
          <input
            className="importModal__input"
            value={nombreEscenario}
            onChange={(e) => setNombreEscenario(e.target.value)}
            disabled={isRunning}
            placeholder="Ej: Datos Marzo 2026"
          />
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Archivo escenario (TXT)</div>
        <input
          className="importModal__file"
          type="file"
          accept=".txt"
          disabled={isRunning}
          onChange={async (e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            try {
              await onLoadContent(f);
            } catch {
              // noop
            }
          }}
        />
        {file ? <div className="importModal__hint">{file.name}</div> : null}
      </div>

      {file ? (
        <ImportMappingTable
          titleLeft={`Filas: ${importState.rows.length}${rowIndexMap ? ` | Mostrando no resueltas: ${rowIndexMap.length}` : ""}`}
          titleRight={`Mapping errs: ${mappingErrs} | Row errs: ${rowErrs}`}
          columns={importState.columns}
          columnUnits={importState.columnUnits}
          selectedCols={importState.selectedCols}
          selectedRows={importState.selectedRows}
          rows={importState.rows}
          mapping={importState.mapping}
          rowErrors={importState.rowErrors}
          mappingErrors={importState.mappingErrors}
          fieldOptions={fieldOptions as any}
          onChangeMapping={onChangeMapping}
          onChangeColSelected={onChangeColSelected}
          onChangeAllCols={onChangeAllCols}
          onChangeRowSelected={onChangeRowSelected}
          onChangeAllRows={onChangeAllRowsView}
          onChangeCell={onChangeCell}
          disabled={isRunning}
          rowIndexMap={rowIndexMap}
          invalidCells={invalidCells}
        />
      ) : null}

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function PozoCapaTab(props: {
  proyectoId: string | null;
  file: File | null;
  setFile: (f: File | null) => void;
  importState: any;
  isRunning: boolean;
  error: string | null;

  onLoadContent: (f: File | null) => Promise<void>;

  onChangeMapping: (colIndex: number, mapping: string) => void;
  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;

  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;

  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;

  viewMode: PozoCapaViewMode;
  setViewMode: (m: PozoCapaViewMode) => void;
  report: PozoCapaResolveReport | null;

  invalidCells: InvalidCellsMap;
}) {
  const {
    proyectoId,
    file,
    setFile,
    importState,
    isRunning,
    error,
    onLoadContent,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    viewMode,
    setViewMode,
    report,
    invalidCells,
  } = props;

  const mappingErrs = importState.mappingErrors?.length ?? 0;
  const rowErrs = Object.keys(importState.rowErrors ?? {}).length;

  const unresolvedNameRowIndices = useMemo(() => {
    if (!report) return [];
    return report.unresolvedRowIndices;
  }, [report]);

  const rowIndexMap =
    viewMode === "unresolved" && report ? unresolvedNameRowIndices : null;

  const invalidBulkGroups = useMemo(() => {
    return buildInvalidBulkReplaceGroups({
      rows: importState.rows ?? [],
      columns: importState.columns ?? [],
      invalidCells: invalidCells ?? {},
      rowScope: rowIndexMap,
    });
  }, [importState.rows, importState.columns, invalidCells, rowIndexMap]);

  const [bulkReplaceValues, setBulkReplaceValues] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setBulkReplaceValues({});
  }, [viewMode, invalidBulkGroups.length]);


  const onChangeAllRowsView = (sel: boolean) => {
    if (!rowIndexMap) {
      onChangeAllRows(sel);
      return;
    }
    for (const idx of rowIndexMap) {
      onChangeRowSelected(idx, sel);
    }
  };

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>
        <div style={{ opacity: 0.85 }}>
          Subí el TXT de Pozo-Capa y mapeá columnas (Pozo/Capa/Tope/Base). Podés
          excluir filas/columnas.
        </div>
      </div>

      {report ? (
        <div
          className="importModal__hint"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
          }}
        >
          {report.ok ? (
            <div>
              ✅ Validación OK: <b>{report.resolved}</b> /{" "}
              <b>{report.totalSelected}</b> filas resueltas.
            </div>
          ) : (
            <div>
              ❌ Faltan resolver: <b>{report.resolved}</b> /{" "}
              <b>{report.totalSelected}</b> (no resueltas por Pozo/Capa:{" "}
              <b>{unresolvedNameRowIndices.length}</b>)
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("unresolved")}
                >
                  Mostrar solo no resueltas
                </button>
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("all")}
                >
                  Mostrar todas
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="importModal__hint" style={{ opacity: 0.85 }}>
          Ejecutá <b>Dry-run</b> para validar las filas contra la DB y marcar
          celdas inválidas.
        </div>
      )}


      {viewMode === "unresolved" && invalidBulkGroups.length > 0 ? (
        <div className="importModal__groupSection">
          <div className="importModal__groupTitle">
            Reemplazo rapido en filas no resueltas
          </div>

          <div className="importModal__groupList">
            {invalidBulkGroups.map((item) => {
              const nextValue = bulkReplaceValues[item.id] ?? "";

              return (
                <div key={item.id} className="importModal__groupItem">
                  <div className="importModal__groupLabel">
                    <span>{item.colLabel}:</span>
                    <code>{item.label}</code>
                    <span>({item.count} filas)</span>
                  </div>

                  <div className="importModal__groupActions">
                    <input
                      className="importModal__groupInput"
                      value={nextValue}
                      onChange={(e) =>
                        setBulkReplaceValues((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      disabled={isRunning}
                      placeholder="Nuevo valor"
                    />

                    <button
                      type="button"
                      className="osm__footerBtn"
                      disabled={isRunning || !nextValue.trim()}
                      onClick={() => {
                        for (const rowIndex of item.rowIndices) {
                          onChangeCell(rowIndex, item.colIndex, nextValue);
                        }
                      }}
                    >
                      Reemplazar todas
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="importModal__box">
        <div className="importModal__boxTitle">Archivo Pozo-Capa (TXT)</div>
        <input
          className="importModal__file"
          type="file"
          accept=".txt"
          disabled={isRunning}
          onChange={async (e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            try {
              await onLoadContent(f);
            } catch {
              // noop
            }
          }}
        />
        {file ? <div className="importModal__hint">{file.name}</div> : null}
      </div>

      {file ? (
        <ImportMappingTable
          titleLeft={`Filas: ${importState.rows.length}${rowIndexMap ? ` | Mostrando no resueltas: ${rowIndexMap.length}` : ""}`}
          titleRight={`Mapping errs: ${mappingErrs} | Row errs: ${rowErrs}`}
          columns={importState.columns}
          columnUnits={importState.columnUnits}
          selectedCols={importState.selectedCols}
          selectedRows={importState.selectedRows}
          rows={importState.rows}
          mapping={importState.mapping}
          rowErrors={importState.rowErrors}
          mappingErrors={importState.mappingErrors}
          fieldOptions={POZOCAPA_FIELDS as any}
          onChangeMapping={onChangeMapping}
          onChangeColSelected={onChangeColSelected}
          onChangeAllCols={onChangeAllCols}
          onChangeRowSelected={onChangeRowSelected}
          onChangeAllRows={onChangeAllRowsView}
          onChangeCell={onChangeCell}
          disabled={isRunning}
          rowIndexMap={rowIndexMap}
          invalidCells={invalidCells}
        />
      ) : null}

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function SetEstadoPozosTab(props: {
  proyectoId: string | null;
  nombreSetEstadoPozos: string;
  setNombreSetEstadoPozos: (v: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  importState: SetEstadoImportState;
  isRunning: boolean;
  error: string | null;
  onLoadContent: (f: File | null) => Promise<void>;
  onChangeMapping: (colIndex: number, mapping: string) => void;
  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;
  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;
  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  onReplaceValue: (
    colIndex: number,
    fromValue: string,
    toValue: string,
    rowIndices: number[],
  ) => number;
  viewMode: PozoCapaViewMode;
  setViewMode: (m: PozoCapaViewMode) => void;
  report: SetEstadoResolveReport | null;
  invalidCells: InvalidCellsMap;
}) {
  const {
    proyectoId,
    nombreSetEstadoPozos,
    setNombreSetEstadoPozos,
    file,
    setFile,
    importState,
    isRunning,
    error,
    onLoadContent,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    onReplaceValue,
    viewMode,
    setViewMode,
    report,
    invalidCells,
  } = props;

  const mappingErrs = importState.mappingErrors?.length ?? 0;
  const rowErrs = Object.keys(importState.rowErrors ?? {}).length;

  const unresolvedRowIndices = useMemo(() => {
    if (!report) return [];
    return report.unresolvedRowIndices;
  }, [report]);

  const invalidBulkGroups = useMemo(() => {
    return buildInvalidBulkReplaceGroups({
      rows: importState.rows ?? [],
      columns: importState.columns ?? [],
      invalidCells: invalidCells ?? {},
      rowScope: viewMode === "unresolved" ? unresolvedRowIndices : null,
    });
  }, [importState.rows, importState.columns, invalidCells, viewMode, unresolvedRowIndices]);

  const rowIndexMap =
    viewMode === "unresolved" && report ? unresolvedRowIndices : null;

  const onChangeAllRowsView = (sel: boolean) => {
    if (!rowIndexMap) {
      onChangeAllRows(sel);
      return;
    }
    for (const idx of rowIndexMap) {
      onChangeRowSelected(idx, sel);
    }
  };

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>
        <div style={{ opacity: 0.85 }}>
          Subi TXT/CSV de set estado con columnas Pozo/Capa/Fecha/Estado.
        </div>
      </div>

      {report ? (
        <div
          className="importModal__hint"
          style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
        >
          {report.ok ? (
            <div>
              Validacion OK: <b>{report.resolved}</b> / <b>{report.totalSelected}</b> filas resueltas.
            </div>
          ) : (
            <div>
              Faltan resolver: <b>{report.resolved}</b> / <b>{report.totalSelected}</b> (unresolved: <b>{report.unresolvedRowIndices.length}</b>)
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button type="button" className="osm__footerBtn" onClick={() => setViewMode("unresolved")}>
                  Mostrar solo no resueltas
                </button>
                <button type="button" className="osm__footerBtn" onClick={() => setViewMode("all")}>
                  Mostrar todas
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="importModal__hint" style={{ opacity: 0.85 }}>
          Ejecuta <b>Dry-run</b> para validar todas las filas contra DB.
        </div>
      )}

      <InvalidBulkReplacePanel
        groups={invalidBulkGroups}
        disabled={isRunning}
        onReplace={onReplaceValue}
      />

      <div className="importModal__box">
        <div className="importModal__boxTitle">Configuracion del set</div>
        <div className="importModal__row">
          <div className="importModal__label">Nombre del set</div>
          <input
            className="importModal__input"
            value={nombreSetEstadoPozos}
            onChange={(e) => setNombreSetEstadoPozos(e.target.value)}
            disabled={isRunning}
            placeholder="Ej: Estado base"
          />
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Archivo Set Estado Pozos (CSV/TXT)</div>
        <input
          className="importModal__file"
          type="file"
          accept=".csv,.txt"
          disabled={isRunning}
          onChange={async (e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            try {
              await onLoadContent(f);
            } catch {
              // noop
            }
          }}
        />
        {file ? <div className="importModal__hint">{file.name}</div> : null}
      </div>

      {file ? (
        <ImportMappingTable
          titleLeft={`Filas: ${importState.rows.length}${rowIndexMap ? ` | Mostrando no resueltas: ${rowIndexMap.length}` : ""}`}
          titleRight={`Mapping errs: ${mappingErrs} | Row errs: ${rowErrs}`}
          columns={importState.columns}
          columnUnits={importState.columnUnits}
          selectedCols={importState.selectedCols}
          selectedRows={importState.selectedRows}
          rows={importState.rows}
          mapping={importState.mapping as any}
          rowErrors={importState.rowErrors}
          mappingErrors={importState.mappingErrors}
          fieldOptions={SET_ESTADO_POZOS_FIELDS as any}
          onChangeMapping={onChangeMapping}
          onChangeColSelected={onChangeColSelected}
          onChangeAllCols={onChangeAllCols}
          onChangeRowSelected={onChangeRowSelected}
          onChangeAllRows={onChangeAllRowsView}
          onChangeCell={onChangeCell}
          disabled={isRunning}
          rowIndexMap={rowIndexMap}
          invalidCells={invalidCells}
        />
      ) : null}

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}
function MapsTab(props: {
  proyectoId: string | null;
  value: string;
  setValue: (v: string) => void;
  isRunning: boolean;
  error: string | null;
}) {
  const { proyectoId, value, setValue, isRunning, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>

        <div style={{ opacity: 0.85 }}>
          Pegá un <b>JSON</b> con el payload de Maps.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Payload JSON (Maps)</div>
        <textarea
          className="importModal__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isRunning}
          placeholder={`{
  "rows": [
    { "capaId": "...", "grupoVariableId": "...", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function DatabaseTab(props: {
  proyectoId: string | null;
  lastKind: "capas" | "pozoCapa" | "escenarios" | "setEstadoPozos" | "maps";
  lastDryRun: any | null;
  lastCommit: any | null;
  error: string | null;
}) {
  const { proyectoId, lastKind, lastDryRun, lastCommit, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__box">
        <div className="importModal__boxTitle">Contexto</div>

        <div className="importModal__p">
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span style={{ opacity: 0.7 }}>(no seleccionado)</span>
          )}
        </div>

        <div className="importModal__p">
          <b>Último tipo:</b> <code>{lastKind}</code>
        </div>
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}

      <div className="importModal__box">
        <div className="importModal__boxTitle">Dry-run</div>
        {lastDryRun ? (
          <pre className="importModal__pre">
            {JSON.stringify(lastDryRun, null, 2)}
          </pre>
        ) : (
          <div className="importModal__hint">
            Todavía no ejecutaste dry-run.
          </div>
        )}
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Commit</div>
        {lastCommit ? (
          <pre className="importModal__pre">
            {JSON.stringify(lastCommit, null, 2)}
          </pre>
        ) : (
          <div className="importModal__hint">Todavía no ejecutaste commit.</div>
        )}
      </div>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="importModal__col">
      <div className="importModal__box">
        <div className="importModal__boxTitle">Capas (TXT)</div>
        <pre className="importModal__pre">{`CAPA
ACU-MO5
MOL-01`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Pozo-Capa (TXT)</div>
        <pre className="importModal__pre">{`POZO\tCAPA\tTOPE\tBASE
PZ-001\tMOL-01\t1234.5\t1301.2
PZ-002\tMOL-01\t1200\t1280`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Escenarios (TXT)</div>
        <pre className="importModal__pre">{`# Datos
pozo capa fecha petroleo agua gas inyeccionAgua
PZ-001 MOL-01 2026-03-01 120 30 15 0
PZ-001 MOL-02 2026-03-01 80 20 10 0`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Maps (JSON payload)</div>
        <pre className="importModal__pre">{`{
  "rows": [
    { "capaId": "...", "grupoVariableId": "...", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}</pre>
      </div>
    </div>
  );
}

/** ===== Tabla virtualizada ===== */

type VirtualRowProps2<T> = {
  index: number;
  style: React.CSSProperties;
  data: T;
};

function ImportMappingTable(props: {
  titleLeft: string;
  titleRight: string;
  columns: string[];
  columnUnits?: string[];

  selectedCols: boolean[];
  selectedRows: boolean[];

  rows: { rowNumber: number; cells: string[] }[];
  mapping: Array<string>;
  rowErrors: Record<number, string[]>;
  mappingErrors: string[];
  fieldOptions: Array<{ key: string; label: string }>;
  onChangeMapping: (colIndex: number, mapping: string) => void;

  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;

  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;

  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  extraRight?: React.ReactNode;
  disabled?: boolean;
  rowIndexMap?: number[] | null;
  invalidCells?: InvalidCellsMap;
}) {
  const {
    titleLeft,
    titleRight,
    columns,
    columnUnits,
    selectedCols,
    selectedRows,
    rows,
    mapping,
    rowErrors,
    mappingErrors,
    fieldOptions,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    extraRight,
    disabled,
    rowIndexMap,
    invalidCells,
  } = props;

  const viewIndices = useMemo(() => {
    if (rowIndexMap && rowIndexMap.length >= 0) return rowIndexMap;
    return null;
  }, [rowIndexMap]);

  const allRowsChecked = useMemo(() => {
    const indices = viewIndices ?? rows.map((_, i) => i);
    return (
      indices.length > 0 &&
      indices.every((i) => (selectedRows[i] ?? true) === true)
    );
  }, [viewIndices, rows, selectedRows]);

  const someRowsChecked = useMemo(() => {
    const indices = viewIndices ?? rows.map((_, i) => i);
    return indices.some((i) => (selectedRows[i] ?? true) === true);
  }, [viewIndices, rows, selectedRows]);

  const allColsChecked =
    selectedCols.length > 0 && selectedCols.every((v) => v === true);
  const someColsChecked = selectedCols.some((v) => v === true);

  const COL_W_LINE = 70;
  const COL_W_SEL = 44;
  const COL_W_DATA = 240;
  const COL_W_COLMASTER = 44;

  const gridTemplateColumns = useMemo(() => {
    const dataCols = columns.map(() => `${COL_W_DATA}px`).join(" ");
    return `${COL_W_LINE}px ${COL_W_SEL}px ${dataCols} ${COL_W_COLMASTER}px`;
  }, [columns]);

  const totalWidth = useMemo(() => {
    return (
      COL_W_LINE + COL_W_SEL + columns.length * COL_W_DATA + COL_W_COLMASTER
    );
  }, [columns.length]);

  const ROW_HEIGHT = 46;
  const LIST_HEIGHT = 420;

  type RowData = {
    rows: { rowNumber: number; cells: string[] }[];
    columns: string[];
    selectedCols: boolean[];
    selectedRows: boolean[];
    mapping: string[];
    rowErrors: Record<number, string[]>;
    disabled?: boolean;
    rowIndexMap?: number[] | null;
    invalidCells?: InvalidCellsMap;
    onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
    onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  };

  const itemData: RowData = useMemo(
    () => ({
      rows,
      columns,
      selectedCols,
      selectedRows,
      mapping,
      rowErrors,
      disabled,
      rowIndexMap: viewIndices,
      invalidCells,
      onChangeRowSelected,
      onChangeCell,
    }),
    [
      rows,
      columns,
      selectedCols,
      selectedRows,
      mapping,
      rowErrors,
      disabled,
      viewIndices,
      invalidCells,
      onChangeRowSelected,
      onChangeCell,
    ],
  );

  const Row = ({ index, style, data }: VirtualRowProps2<RowData>) => {
    const srcIndex = data.rowIndexMap ? data.rowIndexMap[index] : index;

    const row = data.rows[srcIndex];
    if (!row) {
      return <div style={style} />;
    }
    const isRowSelected = data.selectedRows[srcIndex] ?? true;
    const errs = data.rowErrors[srcIndex] ?? [];

    return (
      <div
        className={`npm-vrow ${errs.length ? "npm-vrow-haserror" : ""}`}
        style={{ ...style, gridTemplateColumns }}
      >
        <div className="npm-vcell npm-vcell-line">{row.rowNumber}</div>

        <div className="npm-vcell npm-vcell-sel">
          <input
            type="checkbox"
            checked={isRowSelected}
            onChange={(e) =>
              data.onChangeRowSelected(srcIndex, e.target.checked)
            }
            disabled={data.disabled}
            aria-label={`Incluir fila ${row.rowNumber}`}
          />
        </div>

        {data.columns.map((_, cIdx) => {
          const colEnabled = data.selectedCols[cIdx] ?? true;
          const isIgnored =
            (data.mapping[cIdx] ?? "__ignore__") === "__ignore__";
          const cellDisabled = data.disabled || !colEnabled || !isRowSelected;

          const invalidKey = `${srcIndex}:${cIdx}`;
          const invalidReason = data.invalidCells?.[invalidKey];

          const cls = [
            "npm-vcell",
            "npm-vcell-data",
            isIgnored ? "npm-vcell-ignored" : "",
            !colEnabled ? "npm-vcell-disabled" : "",
            !isRowSelected ? "npm-vcell-rowdisabled" : "",
            invalidReason ? "npm-vcell-invalid" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={cIdx}
              className={cls}
              title={
                invalidReason ? `no validado (${invalidReason})` : undefined
              }
            >
              <input
                className="npm-vinput"
                value={row.cells[cIdx] ?? ""}
                onChange={(e) =>
                  data.onChangeCell(srcIndex, cIdx, e.target.value)
                }
                disabled={cellDisabled}
              />
            </div>
          );
        })}

        <div className="npm-vcell npm-vcell-colmaster" />
      </div>
    );
  };

  const itemCount = viewIndices ? viewIndices.length : rows.length;

  return (
    <div className="npm-preview">
      <div className="npm-previewbar">
        <span className="npm-badge">{titleLeft}</span>

        <div className="npm-previewbar-right">
          {extraRight}
          <span className="npm-badge">{titleRight}</span>
        </div>
      </div>

      {mappingErrors.length > 0 ? (
        <div className="npm-maperror">
          <strong>Problemas de mapeo:</strong>
          <ul>
            {mappingErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="npm-tablewrap npm-tablewrap--virt">
        <div className="npm-virt-scroll">
          <div
            className="npm-vhead"
            style={{ gridTemplateColumns, width: totalWidth }}
          >
            <div className="npm-vhcell npm-vhcell-line">Línea</div>

            <div className="npm-vhcell npm-vhcell-sel">
              <input
                type="checkbox"
                checked={allRowsChecked}
                ref={(el) => {
                  if (!el) return;
                  el.indeterminate = !allRowsChecked && someRowsChecked;
                }}
                onChange={(e) => onChangeAllRows(e.target.checked)}
                disabled={disabled}
                aria-label="Seleccionar todas las filas"
                title="Seleccionar todas las filas"
              />
            </div>

            {columns.map((col, cIdx) => {
              const current = mapping[cIdx] ?? "__ignore__";
              const unit = (columnUnits?.[cIdx] ?? "").trim();
              const colEnabled = selectedCols[cIdx] ?? true;

              return (
                <div
                  key={cIdx}
                  className={`npm-vhcell npm-vhcell-data ${!colEnabled ? "npm-vhcell-disabled" : ""}`}
                >
                  <div className="npm-vh-top">
                    <div className="npm-vh-title">{col}</div>
                    <input
                      type="checkbox"
                      checked={colEnabled}
                      onChange={(e) =>
                        onChangeColSelected(cIdx, e.target.checked)
                      }
                      disabled={disabled}
                      aria-label={`Incluir columna ${col}`}
                      title="Incluir/Excluir columna"
                    />
                  </div>

                  {unit ? <div className="npm-vh-unit">{unit}</div> : null}

                  <select
                    className="npm-vh-select"
                    value={current}
                    onChange={(e) => onChangeMapping(cIdx, e.target.value)}
                    disabled={disabled || !colEnabled}
                  >
                    <option value="__ignore__">Ignorar</option>
                    {fieldOptions.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <div className="npm-vhcell npm-vhcell-colmaster">
              <input
                type="checkbox"
                checked={allColsChecked}
                ref={(el) => {
                  if (!el) return;
                  el.indeterminate = !allColsChecked && someColsChecked;
                }}
                onChange={(e) => onChangeAllCols(e.target.checked)}
                disabled={disabled}
                aria-label="Seleccionar todas las columnas"
                title="Seleccionar todas las columnas"
              />
            </div>
          </div>

          <div style={{ width: totalWidth }}>
            <FixedVirtualList<RowData>
              height={LIST_HEIGHT}
              width={totalWidth}
              itemCount={itemCount}
              itemSize={ROW_HEIGHT}
              itemData={itemData}
              overscan={6}
            >
              {Row}
            </FixedVirtualList>
          </div>
        </div>
      </div>

      {Object.keys(rowErrors).length > 0 ? (
        <div className="npm-maperror">
          <strong>Errores de filas:</strong> Hay {Object.keys(rowErrors).length}{" "}
          filas con problemas.
        </div>
      ) : null}
    </div>
  );
}

function FixedVirtualList<T>(props: {
  height: number;
  width: number;
  itemCount: number;
  itemSize: number;
  itemData: T;
  overscan?: number;
  children: (p: VirtualRowProps2<T>) => React.ReactNode;
}) {
  const {
    height,
    width,
    itemCount,
    itemSize,
    itemData,
    overscan = 6,
    children,
  } = props;

  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = itemCount * itemSize;
  const visibleCount = Math.max(1, Math.ceil(height / itemSize) + overscan * 2);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscan);
  const endIndex = Math.min(
    Math.max(0, itemCount - 1),
    startIndex + visibleCount - 1,
  );

  const items: React.ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i += 1) {
    items.push(
      <React.Fragment key={i}>
        {children({
          index: i,
          data: itemData,
          style: {
            position: "absolute",
            top: i * itemSize,
            height: itemSize,
            width: "100%",
          },
        })}
      </React.Fragment>,
    );
  }

  return (
    <div
      style={{
        height,
        width,
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
      }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>{items}</div>
    </div>
  );
}
































































































