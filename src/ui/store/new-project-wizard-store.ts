// src/store/new-project-wizard-store.ts
import { create } from "zustand";

export type NewProjectStep = "proyecto" | "capas" | "pozos" | "pozo-capa";

type ProyectoDraft = {
  nombre: string;
  limitesTemporalDesde: string; // YYYY-MM-DD
  limitesTemporalHasta: string; // YYYY-MM-DD
  grillaN: string; // N (NxN)
};

type ImportEntity = "Capa" | "Pozo" | "PozoCapa";

type CapaFieldKey = "nombre";
type PozoFieldKey = "nombre" | "x" | "y";
type PozoCapaFieldKey = "pozo" | "capa" | "tope" | "base";

type FieldKeyByEntity = {
  Capa: CapaFieldKey;
  Pozo: PozoFieldKey;
  PozoCapa: PozoCapaFieldKey;
};

type Ignore = "__ignore__";
type ColumnMapping<E extends ImportEntity> = FieldKeyByEntity[E] | Ignore;

export type TxtRow = {
  rowNumber: number; // línea real 1-based del archivo
  cells: string[];
};

export type ImportTableState<E extends ImportEntity> = {
  entity: E;
  contentRaw: string;
  columns: string[];
  columnUnits: string[]; // units row (misma longitud que columns)
  rows: TxtRow[];

  // selección (payload)
  selectedCols: boolean[]; // length = columns
  selectedRows: boolean[]; // length = rows

  mapping: ColumnMapping<E>[];
  rowErrors: Record<number, string[]>;
  mappingErrors: string[];
};

type NewProjectWizardState = {
  step: NewProjectStep;

  draft: ProyectoDraft;
  proyecto: Proyecto | null;

  capasFile: File | null;
  pozosFile: File | null;
  pozoCapaFile: File | null;

  capasImport: ImportTableState<"Capa">;
  pozosImport: ImportTableState<"Pozo">;
  pozoCapaImport: ImportTableState<"PozoCapa">;

  loading: boolean;
  error: string;

  setStep: (step: NewProjectStep) => void;
  setDraft: (patch: Partial<ProyectoDraft>) => void;
  setProyecto: (proyecto: Proyecto | null) => void;

  setCapasFile: (file: File | null) => void;
  setPozosFile: (file: File | null) => void;
  setPozoCapaFile: (file: File | null) => void;

  setImportFromContent: (
    entity: "Capa" | "Pozo" | "PozoCapa",
    content: string,
  ) => void;

  setImportMapping: (
    entity: "Capa" | "Pozo" | "PozoCapa",
    colIndex: number,
    mapping:
      | ColumnMapping<"Capa">
      | ColumnMapping<"Pozo">
      | ColumnMapping<"PozoCapa">,
  ) => void;

  setImportCell: (
    entity: "Capa" | "Pozo" | "PozoCapa",
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => void;

  // selección (FAST: NO revalida)
  setImportRowSelected: (
    entity: "Capa" | "Pozo" | "PozoCapa",
    rowIndex: number,
    selected: boolean,
  ) => void;

  setImportColSelected: (
    entity: "Capa" | "Pozo" | "PozoCapa",
    colIndex: number,
    selected: boolean,
  ) => void;

  setImportAllRowsSelected: (
    entity: "Capa" | "Pozo" | "PozoCapa",
    selected: boolean,
  ) => void;

  setImportAllColsSelected: (
    entity: "Capa" | "Pozo" | "PozoCapa",
    selected: boolean,
  ) => void;

  validateImport: (entity: "Capa" | "Pozo" | "PozoCapa") => boolean;

  buildContentForCommit: (entity: "Capa" | "Pozo" | "PozoCapa") => string;

  normalizeCapasNames: () => void;

  clearImport: (entity: "Capa" | "Pozo" | "PozoCapa") => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;

  reset: () => void;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const initialDraft = (): ProyectoDraft => {
  const from = todayISO();
  const to = `${new Date().getFullYear() + 5}-12-31`;
  return {
    nombre: "",
    limitesTemporalDesde: from,
    limitesTemporalHasta: to,
    grillaN: "200",
  };
};

function emptyImportState<E extends ImportEntity>(
  entity: E,
): ImportTableState<E> {
  return {
    entity,
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

// ---------------------------
// Parser tabular genérico
// ---------------------------

function splitRow(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

// Header heurístico: tokens solo letras/underscore (sin dígitos)
function isHeaderTokens(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((t) => /^[A-Za-z_]+$/.test(t));
}

function isUnitsRow(tokens: string[], expectedCols: number): boolean {
  if (tokens.length === 0) return false;
  const bracketish = tokens.filter((t) => /^\s*\[.*\]\s*$/.test(t)).length;
  const ratio = bracketish / Math.max(1, expectedCols);
  return ratio >= 0.6;
}

function parseTabularTxt(content: string): {
  columns: string[];
  columnUnits: string[];
  rows: TxtRow[];
} {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { columns: [], columnUnits: [], rows: [] };

  const firstTokens = splitRow(lines[0]);
  const hasHeader = isHeaderTokens(firstTokens);

  let dataStart = hasHeader ? 1 : 0;

  let maxCols = hasHeader ? firstTokens.length : 0;
  for (let i = dataStart; i < lines.length; i += 1) {
    maxCols = Math.max(maxCols, splitRow(lines[i]).length);
  }
  if (maxCols === 0) maxCols = 1;

  const columns = hasHeader
    ? [
        ...firstTokens,
        ...Array(Math.max(0, maxCols - firstTokens.length)).fill(""),
      ]
        .slice(0, maxCols)
        .map((c, idx) => (c && c.trim() ? c.trim() : `col${idx + 1}`))
    : Array.from({ length: maxCols }, (_, i) => `col${i + 1}`);

  let columnUnits = Array.from({ length: maxCols }, () => "");
  if (hasHeader && lines.length > 1) {
    const maybeUnitsTokens = splitRow(lines[1]);
    if (isUnitsRow(maybeUnitsTokens, maxCols)) {
      columnUnits = [
        ...maybeUnitsTokens,
        ...Array(Math.max(0, maxCols - maybeUnitsTokens.length)).fill(""),
      ]
        .slice(0, maxCols)
        .map((u) => (u ?? "").trim());

      dataStart = 2; // NO es data
    }
  }

  const rows: TxtRow[] = [];
  for (let i = dataStart; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const tokens = splitRow(lines[i]);
    const cells = [
      ...tokens,
      ...Array(Math.max(0, maxCols - tokens.length)).fill(""),
    ].slice(0, maxCols);
    rows.push({ rowNumber, cells });
  }

  return { columns, columnUnits, rows };
}

// ---------------------------
// Auto-mapping por entidad
// ---------------------------

function autoMappingForEntity(
  entity: "Capa",
  columns: string[],
): ColumnMapping<"Capa">[];
function autoMappingForEntity(
  entity: "Pozo",
  columns: string[],
): ColumnMapping<"Pozo">[];
function autoMappingForEntity(
  entity: "PozoCapa",
  columns: string[],
): ColumnMapping<"PozoCapa">[];
function autoMappingForEntity(entity: ImportEntity, columns: string[]) {
  const colLower = columns.map((c) => c.toLowerCase().trim());

  if (entity === "Capa") {
    return colLower.map((c) =>
      c === "capa" || c === "nombre" ? "nombre" : "__ignore__",
    );
  }

  if (entity === "Pozo") {
    return colLower.map((c) => {
      if (c === "pozo" || c === "nombre") return "nombre";
      if (c === "x") return "x";
      if (c === "y") return "y";
      return "__ignore__";
    });
  }

  // PozoCapa
  return colLower.map((c) => {
    if (c === "pozo") return "pozo";
    if (c === "capa") return "capa";
    if (c === "tope") return "tope";
    if (c === "base") return "base";
    return "__ignore__";
  });
}

// ---------------------------
// Helpers selección → effective mapping / rows
// ---------------------------

function getEffectiveMapping<E extends ImportEntity>(
  mapping: ColumnMapping<E>[],
  selectedCols: boolean[],
): ColumnMapping<E>[] {
  return mapping.map((m, idx) => (selectedCols[idx] ? m : "__ignore__")) as any;
}

function getSelectedRows(rows: TxtRow[], selectedRows: boolean[]): TxtRow[] {
  return rows.filter((_, idx) => selectedRows[idx]);
}

// ---------------------------
// Validación
// ---------------------------

function validateMapping(
  entity: "Capa",
  mapping: ColumnMapping<"Capa">[],
): string[];
function validateMapping(
  entity: "Pozo",
  mapping: ColumnMapping<"Pozo">[],
): string[];
function validateMapping(
  entity: "PozoCapa",
  mapping: ColumnMapping<"PozoCapa">[],
): string[];
function validateMapping(entity: ImportEntity, mapping: Array<string>) {
  const errs: string[] = [];
  const mapped = new Set(mapping.filter((m) => m !== "__ignore__"));

  if (entity === "Capa") {
    if (!mapped.has("nombre")) {
      errs.push("Tenés que mapear al menos una columna a 'Nombre'.");
    }
  }

  if (entity === "Pozo") {
    const required: PozoFieldKey[] = ["nombre", "x", "y"];
    for (const r of required) {
      if (!mapped.has(r)) errs.push(`Falta mapear el campo requerido: '${r}'.`);
    }
  }

  if (entity === "PozoCapa") {
    const required: PozoCapaFieldKey[] = ["pozo", "capa", "tope", "base"];
    for (const r of required) {
      if (!mapped.has(r)) errs.push(`Falta mapear el campo requerido: '${r}'.`);
    }
  }

  // no duplicar campos
  const counts = new Map<string, number>();
  for (const m of mapping) {
    if (m === "__ignore__") continue;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  for (const [k, v] of counts.entries()) {
    if (v > 1) errs.push(`El campo '${k}' está asignado ${v} veces. Solo una.`);
  }

  return errs;
}

function toNumberFlexible(value: string): number {
  const normalized = (value ?? "").replace(",", ".").trim();
  return Number(normalized);
}

function validateRows(
  entity: "Capa",
  rows: TxtRow[],
  mapping: ColumnMapping<"Capa">[],
): Record<number, string[]>;
function validateRows(
  entity: "Pozo",
  rows: TxtRow[],
  mapping: ColumnMapping<"Pozo">[],
): Record<number, string[]>;
function validateRows(
  entity: "PozoCapa",
  rows: TxtRow[],
  mapping: ColumnMapping<"PozoCapa">[],
): Record<number, string[]>;
function validateRows(
  entity: ImportEntity,
  rows: TxtRow[],
  mapping: Array<string>,
) {
  const rowErrors: Record<number, string[]> = {};

  const findCol = (field: string) => mapping.findIndex((m) => m === field);

  const colNombre = findCol("nombre");
  const colX = findCol("x");
  const colY = findCol("y");

  const colPozo = findCol("pozo");
  const colCapa = findCol("capa");
  const colTope = findCol("tope");
  const colBase = findCol("base");

  const seen = new Set<string>(); // duplicados (solo en filas seleccionadas)

  rows.forEach((row, idx) => {
    const errs: string[] = [];

    if (entity === "Capa") {
      const nombre = (colNombre >= 0 ? row.cells[colNombre] : "").trim();
      if (!nombre) errs.push("Nombre requerido");
      if (nombre) {
        const key = nombre.toLowerCase();
        if (seen.has(key)) errs.push("Duplicado (case-insensitive)");
        else seen.add(key);
      }
    }

    if (entity === "Pozo") {
      const nombre = (colNombre >= 0 ? row.cells[colNombre] : "").trim();
      const xStr = (colX >= 0 ? row.cells[colX] : "").trim();
      const yStr = (colY >= 0 ? row.cells[colY] : "").trim();

      if (!nombre) errs.push("Nombre requerido");
      if (nombre) {
        const key = nombre.toLowerCase();
        if (seen.has(key)) errs.push("Duplicado (case-insensitive)");
        else seen.add(key);
      }

      const x = toNumberFlexible(xStr);
      const y = toNumberFlexible(yStr);
      if (!Number.isFinite(x)) errs.push("x debe ser numérico");
      if (!Number.isFinite(y)) errs.push("y debe ser numérico");
    }

    if (entity === "PozoCapa") {
      const pozo = (colPozo >= 0 ? row.cells[colPozo] : "").trim();
      const capa = (colCapa >= 0 ? row.cells[colCapa] : "").trim();
      const topeStr = (colTope >= 0 ? row.cells[colTope] : "").trim();
      const baseStr = (colBase >= 0 ? row.cells[colBase] : "").trim();

      if (!pozo) errs.push("Pozo requerido");
      if (!capa) errs.push("Capa requerida");

      const tope = toNumberFlexible(topeStr);
      const base = toNumberFlexible(baseStr);
      if (!Number.isFinite(tope)) errs.push("tope debe ser numérico");
      if (!Number.isFinite(base)) errs.push("base debe ser numérico");
      if (Number.isFinite(tope) && Number.isFinite(base) && base < tope) {
        errs.push("base debe ser >= tope");
      }

      if (pozo && capa) {
        const key = `${pozo.toLowerCase()}::${capa.toLowerCase()}`;
        if (seen.has(key)) errs.push("Duplicado (pozo+capa, case-insensitive)");
        else seen.add(key);
      }
    }

    if (errs.length) rowErrors[idx] = errs;
  });

  return rowErrors;
}

// ---------------------------
// Builders commit (respetan selección)
// ---------------------------

function buildCapasContentFromState(state: ImportTableState<"Capa">): string {
  const effMapping = getEffectiveMapping(state.mapping, state.selectedCols);
  const colNombre = effMapping.findIndex((m) => m === "nombre");

  const selected = getSelectedRows(state.rows, state.selectedRows);
  const names = selected
    .map((r) => (colNombre >= 0 ? (r.cells[colNombre] ?? "") : "").trim())
    .filter(Boolean);

  return ["capa", ...names].join("\n");
}

function buildPozosContentFromState(state: ImportTableState<"Pozo">): string {
  const effMapping = getEffectiveMapping(state.mapping, state.selectedCols);
  const colNombre = effMapping.findIndex((m) => m === "nombre");
  const colX = effMapping.findIndex((m) => m === "x");
  const colY = effMapping.findIndex((m) => m === "y");

  const lines: string[] = ["pozo x y"];
  const selected = getSelectedRows(state.rows, state.selectedRows);

  for (const r of selected) {
    const nombre = (colNombre >= 0 ? (r.cells[colNombre] ?? "") : "").trim();
    if (!nombre) continue;

    const x = (colX >= 0 ? (r.cells[colX] ?? "") : "").trim().replace(",", ".");
    const y = (colY >= 0 ? (r.cells[colY] ?? "") : "").trim().replace(",", ".");
    lines.push(`${nombre}\t${x}\t${y}`);
  }

  return lines.join("\n");
}

function buildPozoCapaContentFromState(
  state: ImportTableState<"PozoCapa">,
): string {
  const effMapping = getEffectiveMapping(state.mapping, state.selectedCols);
  const colPozo = effMapping.findIndex((m) => m === "pozo");
  const colCapa = effMapping.findIndex((m) => m === "capa");
  const colTope = effMapping.findIndex((m) => m === "tope");
  const colBase = effMapping.findIndex((m) => m === "base");

  const lines: string[] = ["pozo capa tope base"];
  const selected = getSelectedRows(state.rows, state.selectedRows);

  for (const r of selected) {
    const pozo = (colPozo >= 0 ? (r.cells[colPozo] ?? "") : "").trim();
    const capa = (colCapa >= 0 ? (r.cells[colCapa] ?? "") : "").trim();
    if (!pozo || !capa) continue;

    const tope = (colTope >= 0 ? (r.cells[colTope] ?? "") : "")
      .trim()
      .replace(",", ".");
    const base = (colBase >= 0 ? (r.cells[colBase] ?? "") : "")
      .trim()
      .replace(",", ".");
    lines.push(`${pozo}\t${capa}\t${tope}\t${base}`);
  }

  return lines.join("\n");
}

/**
 * Normaliza nombres tipo:
 * - "ACU0056" -> "ACU-56"
 * - "ACU630A" -> "ACU-630A"
 * - "ACU-0056" -> "ACU-56"
 * - "acu630a" -> "ACU-630A"
 */
function normalizeCapaName(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return raw;

  const m = raw.match(/^([A-Za-z]+)(.*)$/);
  if (!m) return raw;

  const prefix = m[1].toUpperCase();
  let rest = (m[2] ?? "").trim();

  while (rest.startsWith("-")) rest = rest.slice(1).trim();
  if (!rest) return prefix;

  rest = rest.replace(/^(\d+)(.*)$/, (_, digits: string, tail: string) => {
    const stripped = digits.replace(/^0+/, "");
    const normalizedDigits = stripped.length ? stripped : "0";
    return `${normalizedDigits}${tail ?? ""}`;
  });

  return `${prefix}-${rest}`;
}

export const useNewProjectWizardStore = create<NewProjectWizardState>(
  (set, get) => ({
    step: "proyecto",
    draft: initialDraft(),
    proyecto: null,

    capasFile: null,
    pozosFile: null,
    pozoCapaFile: null,

    capasImport: emptyImportState("Capa"),
    pozosImport: emptyImportState("Pozo"),
    pozoCapaImport: emptyImportState("PozoCapa"),

    loading: false,
    error: "",

    setStep: (step) => set({ step }),
    setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
    setProyecto: (proyecto) => set({ proyecto }),

    setCapasFile: (capasFile) =>
      set({
        capasFile,
        capasImport: emptyImportState("Capa"),
      }),

    setPozosFile: (pozosFile) =>
      set({
        pozosFile,
        pozosImport: emptyImportState("Pozo"),
      }),

    setPozoCapaFile: (pozoCapaFile) =>
      set({
        pozoCapaFile,
        pozoCapaImport: emptyImportState("PozoCapa"),
      }),

    setImportFromContent: (entity, content) => {
      const parsed = parseTabularTxt(content);

      const initSelectedCols = parsed.columns.map(() => true);
      const initSelectedRows = parsed.rows.map(() => true);

      if (entity === "Capa") {
        const mapping = autoMappingForEntity("Capa", parsed.columns);

        const effMapping = getEffectiveMapping(mapping, initSelectedCols);
        const mappingErrors = validateMapping("Capa", effMapping as any);
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows("Capa", parsed.rows, effMapping as any)
            : {};

        set({
          capasImport: {
            entity: "Capa",
            contentRaw: content,
            columns: parsed.columns,
            columnUnits: parsed.columnUnits,
            rows: parsed.rows,
            selectedCols: initSelectedCols,
            selectedRows: initSelectedRows,
            mapping,
            mappingErrors,
            rowErrors,
          },
        });
      }

      if (entity === "Pozo") {
        const mapping = autoMappingForEntity("Pozo", parsed.columns);

        const effMapping = getEffectiveMapping(mapping, initSelectedCols);
        const mappingErrors = validateMapping("Pozo", effMapping as any);
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows("Pozo", parsed.rows, effMapping as any)
            : {};

        set({
          pozosImport: {
            entity: "Pozo",
            contentRaw: content,
            columns: parsed.columns,
            columnUnits: parsed.columnUnits,
            rows: parsed.rows,
            selectedCols: initSelectedCols,
            selectedRows: initSelectedRows,
            mapping,
            mappingErrors,
            rowErrors,
          },
        });
      }

      if (entity === "PozoCapa") {
        const mapping = autoMappingForEntity("PozoCapa", parsed.columns);

        const effMapping = getEffectiveMapping(mapping, initSelectedCols);
        const mappingErrors = validateMapping("PozoCapa", effMapping as any);
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows("PozoCapa", parsed.rows, effMapping as any)
            : {};

        set({
          pozoCapaImport: {
            entity: "PozoCapa",
            contentRaw: content,
            columns: parsed.columns,
            columnUnits: parsed.columnUnits,
            rows: parsed.rows,
            selectedCols: initSelectedCols,
            selectedRows: initSelectedRows,
            mapping,
            mappingErrors,
            rowErrors,
          },
        });
      }
    },

    // mapping cambia poco → mantenemos revalidación inmediata
    setImportMapping: (entity, colIndex, mappingValue) => {
      const recompute = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const mapping = [...current.mapping] as any[];
        if (colIndex < 0 || colIndex >= mapping.length) return current;
        mapping[colIndex] = mappingValue as any;

        const effMapping = getEffectiveMapping(
          mapping as any,
          current.selectedCols,
        );

        const mappingErrors = validateMapping(ent as any, effMapping as any);

        const selectedRows = getSelectedRows(
          current.rows,
          current.selectedRows,
        );
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows(ent as any, selectedRows, effMapping as any)
            : {};

        return {
          ...current,
          mapping: mapping as any,
          mappingErrors,
          rowErrors,
        };
      };

      if (entity === "Capa") {
        set({ capasImport: recompute(get().capasImport, "Capa") as any });
        return;
      }
      if (entity === "Pozo") {
        set({ pozosImport: recompute(get().pozosImport, "Pozo") as any });
        return;
      }
      set({
        pozoCapaImport: recompute(get().pozoCapaImport, "PozoCapa") as any,
      });
    },

    // cell edit cambia poco → mantenemos revalidación inmediata (si querés, lo deferimos también)
    setImportCell: (entity, rowIndex, colIndex, value) => {
      const update = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const rows = [...current.rows];
        if (!rows[rowIndex]) return { current, changed: false };

        const cells = [...rows[rowIndex].cells];
        if (colIndex < 0 || colIndex >= cells.length)
          return { current, changed: false };
        cells[colIndex] = value;
        rows[rowIndex] = { ...rows[rowIndex], cells };

        const effMapping = getEffectiveMapping(
          current.mapping,
          current.selectedCols,
        );
        const mappingErrors = validateMapping(ent as any, effMapping as any);

        const selectedRows = getSelectedRows(rows, current.selectedRows);
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows(ent as any, selectedRows, effMapping as any)
            : {};

        return {
          current: { ...current, rows, mappingErrors, rowErrors },
          changed: true,
        };
      };

      if (entity === "Capa") {
        const res = update(get().capasImport, "Capa");
        if (res.changed) set({ capasImport: res.current as any });
        return;
      }
      if (entity === "Pozo") {
        const res = update(get().pozosImport, "Pozo");
        if (res.changed) set({ pozosImport: res.current as any });
        return;
      }
      const res = update(get().pozoCapaImport, "PozoCapa");
      if (res.changed) set({ pozoCapaImport: res.current as any });
    },

    // ✅ FAST PATH: selección NO recalcula errores (cero lag)
    setImportRowSelected: (entity, rowIndex, selected) => {
      const apply = <E extends ImportEntity>(current: ImportTableState<E>) => {
        const selectedRows = [...current.selectedRows];
        if (rowIndex < 0 || rowIndex >= selectedRows.length) return current;
        selectedRows[rowIndex] = selected;
        return { ...current, selectedRows };
      };

      if (entity === "Capa")
        set({ capasImport: apply(get().capasImport) as any });
      else if (entity === "Pozo")
        set({ pozosImport: apply(get().pozosImport) as any });
      else set({ pozoCapaImport: apply(get().pozoCapaImport) as any });
    },

    setImportColSelected: (entity, colIndex, selected) => {
      const apply = <E extends ImportEntity>(current: ImportTableState<E>) => {
        const selectedCols = [...current.selectedCols];
        if (colIndex < 0 || colIndex >= selectedCols.length) return current;
        selectedCols[colIndex] = selected;
        return { ...current, selectedCols };
      };

      if (entity === "Capa")
        set({ capasImport: apply(get().capasImport) as any });
      else if (entity === "Pozo")
        set({ pozosImport: apply(get().pozosImport) as any });
      else set({ pozoCapaImport: apply(get().pozoCapaImport) as any });
    },

    setImportAllRowsSelected: (entity, selected) => {
      const apply = <E extends ImportEntity>(current: ImportTableState<E>) => {
        const selectedRows = current.rows.map(() => selected);
        return { ...current, selectedRows };
      };

      if (entity === "Capa")
        set({ capasImport: apply(get().capasImport) as any });
      else if (entity === "Pozo")
        set({ pozosImport: apply(get().pozosImport) as any });
      else set({ pozoCapaImport: apply(get().pozoCapaImport) as any });
    },

    setImportAllColsSelected: (entity, selected) => {
      const apply = <E extends ImportEntity>(current: ImportTableState<E>) => {
        const selectedCols = current.columns.map(() => selected);
        return { ...current, selectedCols };
      };

      if (entity === "Capa")
        set({ capasImport: apply(get().capasImport) as any });
      else if (entity === "Pozo")
        set({ pozosImport: apply(get().pozosImport) as any });
      else set({ pozoCapaImport: apply(get().pozoCapaImport) as any });
    },

    // ✅ validateImport sigue siendo FULL (para debounce + para bloquear avanzar)
    validateImport: (entity) => {
      const run = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const effMapping = getEffectiveMapping(
          current.mapping,
          current.selectedCols,
        );
        const mappingErrors = validateMapping(ent as any, effMapping as any);

        const rowsToValidate = getSelectedRows(
          current.rows,
          current.selectedRows,
        );
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows(ent as any, rowsToValidate, effMapping as any)
            : {};

        const next = { ...current, mappingErrors, rowErrors };
        const ok =
          mappingErrors.length === 0 && Object.keys(rowErrors).length === 0;
        return { next, ok };
      };

      if (entity === "Capa") {
        const { next, ok } = run(get().capasImport, "Capa");
        set({ capasImport: next as any });
        return ok;
      }
      if (entity === "Pozo") {
        const { next, ok } = run(get().pozosImport, "Pozo");
        set({ pozosImport: next as any });
        return ok;
      }
      const { next, ok } = run(get().pozoCapaImport, "PozoCapa");
      set({ pozoCapaImport: next as any });
      return ok;
    },

    buildContentForCommit: (entity) => {
      if (entity === "Capa")
        return buildCapasContentFromState(get().capasImport);
      if (entity === "Pozo")
        return buildPozosContentFromState(get().pozosImport);
      return buildPozoCapaContentFromState(get().pozoCapaImport);
    },

    normalizeCapasNames: () => {
      const st = get().capasImport;
      const effMapping = getEffectiveMapping(st.mapping, st.selectedCols);
      const colNombre = effMapping.findIndex((m) => m === "nombre");
      if (colNombre < 0) return;

      const rows = st.rows.map((r) => {
        const cells = [...r.cells];
        cells[colNombre] = normalizeCapaName(cells[colNombre] ?? "");
        return { ...r, cells };
      });

      const mappingErrors = validateMapping("Capa", effMapping as any);
      const selectedRows = getSelectedRows(rows, st.selectedRows);
      const rowErrors =
        mappingErrors.length === 0
          ? validateRows("Capa", selectedRows, effMapping as any)
          : {};

      set({
        capasImport: {
          ...st,
          rows,
          mappingErrors,
          rowErrors,
        },
      });
    },

    clearImport: (entity) => {
      if (entity === "Capa") set({ capasImport: emptyImportState("Capa") });
      if (entity === "Pozo") set({ pozosImport: emptyImportState("Pozo") });
      if (entity === "PozoCapa")
        set({ pozoCapaImport: emptyImportState("PozoCapa") });
    },

    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    reset: () =>
      set({
        step: "proyecto",
        draft: initialDraft(),
        proyecto: null,

        capasFile: null,
        pozosFile: null,
        pozoCapaFile: null,

        capasImport: emptyImportState("Capa"),
        pozosImport: emptyImportState("Pozo"),
        pozoCapaImport: emptyImportState("PozoCapa"),

        loading: false,
        error: "",
      }),
  }),
);
