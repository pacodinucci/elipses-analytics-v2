import { create } from "zustand";

export type NewProjectStep =
  | "proyecto"
  | "capas"
  | "pozos"
  | "pozo-capa"
  | "escenarios";

type ProyectoDraft = {
  nombre: string;
  limitesTemporalDesde: string;
  limitesTemporalHasta: string;
  grillaN: string;
};

type ImportEntity = "Capa" | "Pozo" | "PozoCapa" | "Escenario";

type CapaFieldKey = "nombre";
type PozoFieldKey = "nombre" | "x" | "y";
type PozoCapaFieldKey = "pozo" | "capa" | "tope" | "base";
type EscenarioFieldKey =
  | "pozo"
  | "capa"
  | "fecha"
  | "petroleo"
  | "agua"
  | "gas"
  | "inyeccionGas"
  | "inyeccionAgua";

type FieldKeyByEntity = {
  Capa: CapaFieldKey;
  Pozo: PozoFieldKey;
  PozoCapa: PozoCapaFieldKey;
  Escenario: EscenarioFieldKey;
};
type Ignore = "__ignore__";
type ColumnMapping<E extends ImportEntity> = FieldKeyByEntity[E] | Ignore;

export type TxtRow = {
  rowNumber: number;
  cells: string[];
};

export type ImportTableState<E extends ImportEntity> = {
  entity: E;
  contentRaw: string;
  columns: string[];
  columnUnits: string[];
  rows: TxtRow[];
  selectedCols: boolean[];
  selectedRows: boolean[];
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
  scenarioFile: File | null;

  capasImport: ImportTableState<"Capa">;
  pozosImport: ImportTableState<"Pozo">;
  pozoCapaImport: ImportTableState<"PozoCapa">;
  scenarioImport: ImportTableState<"Escenario">;

  loading: boolean;
  error: string;

  setStep: (step: NewProjectStep) => void;
  setDraft: (patch: Partial<ProyectoDraft>) => void;
  setProyecto: (proyecto: Proyecto | null) => void;

  setCapasFile: (file: File | null) => void;
  setPozosFile: (file: File | null) => void;
  setPozoCapaFile: (file: File | null) => void;
  setScenarioFile: (file: File | null) => void;

  setImportFromContent: (entity: ImportEntity, content: string) => void;

  setImportMapping: (
    entity: ImportEntity,
    colIndex: number,
    mapping:
      | ColumnMapping<"Capa">
      | ColumnMapping<"Pozo">
      | ColumnMapping<"PozoCapa">
      | ColumnMapping<"Escenario">
  ) => void;

  setImportCell: (
    entity: ImportEntity,
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => void;

  replaceImportValue: (
    entity: ImportEntity,
    colIndex: number,
    fromValue: string,
    toValue: string,
    onlySelectedRows?: boolean,
  ) => number;

  setImportRowSelected: (
    entity: ImportEntity,
    rowIndex: number,
    selected: boolean,
  ) => void;

  setImportColSelected: (
    entity: ImportEntity,
    colIndex: number,
    selected: boolean,
  ) => void;

  setImportAllRowsSelected: (entity: ImportEntity, selected: boolean) => void;

  setImportAllColsSelected: (entity: ImportEntity, selected: boolean) => void;

  validateImport: (entity: ImportEntity) => boolean;

  buildContentForCommit: (entity: ImportEntity) => string;

  normalizeCapasNames: () => void;

  clearImport: (entity: ImportEntity) => void;

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

function splitRow(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

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

      dataStart = 2;
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
function autoMappingForEntity(
  entity: "Escenario",
  columns: string[],
): ColumnMapping<"Escenario">[];
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

  if (entity === "PozoCapa") {
    return colLower.map((c) => {
      if (c === "pozo") return "pozo";
      if (c === "capa") return "capa";
      if (c === "tope") return "tope";
      if (c === "base") return "base";
      return "__ignore__";
    });
  }

  return colLower.map((c) => {
    if (c === "pozo" || c === "well") return "pozo";
    if (c === "capa" || c === "layer") return "capa";
    if (c === "fecha" || c === "date") return "fecha";
    if (c === "petroleo" || c === "oil") return "petroleo";
    if (c === "agua" || c === "water") return "agua";
    if (c === "gas") return "gas";
    if (c === "inyecciongas" || c === "gas_iny") return "inyeccionGas";
    if (
      c === "inyeccionagua" ||
      c === "agua_iny" ||
      c === "agua_inyectada" ||
      c === "agua_inv"
    ) {
      return "inyeccionAgua";
    }
    return "__ignore__";
  });
}
function getEffectiveMapping<E extends ImportEntity>(
  mapping: ColumnMapping<E>[],
  selectedCols: boolean[],
): ColumnMapping<E>[] {
  return mapping.map((m, idx) => (selectedCols[idx] ? m : "__ignore__")) as any;
}

function getSelectedRows(rows: TxtRow[], selectedRows: boolean[]): TxtRow[] {
  return rows.filter((_, idx) => selectedRows[idx]);
}

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
function validateMapping(
  entity: "Escenario",
  mapping: ColumnMapping<"Escenario">[],
): string[];
function validateMapping(entity: ImportEntity, mapping: Array<string>) {
  const errs: string[] = [];
  const mapped = new Set(mapping.filter((m) => m !== "__ignore__"));

  if (entity === "Capa") {
    if (!mapped.has("nombre")) {
      errs.push("Tenes que mapear al menos una columna a 'Nombre'.");
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

  if (entity === "Escenario") {
    if (!mapped.has("pozo")) {
      errs.push("Falta mapear el campo requerido: 'pozo'.");
    }
    if (!mapped.has("fecha")) {
      errs.push("Falta mapear el campo requerido: 'fecha'.");
    }

    const hasMetric =
      mapped.has("petroleo") ||
      mapped.has("agua") ||
      mapped.has("gas") ||
      mapped.has("inyeccionGas") ||
      mapped.has("inyeccionAgua");

    if (!hasMetric) {
      errs.push(
        "Tenes que mapear al menos una metrica: petroleo / agua / gas / inyeccionGas / inyeccionAgua.",
      );
    }
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
function toNumberFlexible(value: string): number {
  const normalized = (value ?? "").replace(",", ".").trim();
  return Number(normalized);
}

function isValidScenarioDate(value: string): boolean {
  const v = (value ?? "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
  if (/^\d{4}-\d{1,2}$/.test(v)) return true;
  if (/^\d{1,2}-\d{4}$/.test(v)) return true;

  return false;
}

function validateRows(
  entity: "Capa",
  rows: TxtRow[],
  mapping: ColumnMapping<"Capa">[],
  selectedRows?: boolean[],
): Record<number, string[]>;
function validateRows(
  entity: "Pozo",
  rows: TxtRow[],
  mapping: ColumnMapping<"Pozo">[],
  selectedRows?: boolean[],
): Record<number, string[]>;
function validateRows(
  entity: "PozoCapa",
  rows: TxtRow[],
  mapping: ColumnMapping<"PozoCapa">[],
  selectedRows?: boolean[],
): Record<number, string[]>;
function validateRows(
  entity: "Escenario",
  rows: TxtRow[],
  mapping: ColumnMapping<"Escenario">[],
  selectedRows?: boolean[],
): Record<number, string[]>;
function validateRows(
  entity: ImportEntity,
  rows: TxtRow[],
  mapping: Array<string>,
  selectedRows?: boolean[],
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

  const colFecha = findCol("fecha");
  const colPetroleo = findCol("petroleo");
  const colAgua = findCol("agua");
  const colGas = findCol("gas");
  const colInyGas = findCol("inyeccionGas");
  const colInyAgua = findCol("inyeccionAgua");

  const seen = new Set<string>();

  rows.forEach((row, idx) => {
    if (selectedRows && !selectedRows[idx]) return;

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
      if (!Number.isFinite(x)) errs.push("x debe ser numerico");
      if (!Number.isFinite(y)) errs.push("y debe ser numerico");
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
      if (!Number.isFinite(tope)) errs.push("tope debe ser numerico");
      if (!Number.isFinite(base)) errs.push("base debe ser numerico");
      if (Number.isFinite(tope) && Number.isFinite(base) && base < tope) {
        errs.push("base debe ser >= tope");
      }

      if (pozo && capa) {
        const key = `${pozo.toLowerCase()}::${capa.toLowerCase()}`;
        if (seen.has(key)) errs.push("Duplicado (pozo+capa, case-insensitive)");
        else seen.add(key);
      }
    }

    if (entity === "Escenario") {
      const pozo = (colPozo >= 0 ? row.cells[colPozo] : "").trim();
      const capa = (colCapa >= 0 ? row.cells[colCapa] : "").trim();
      const fecha = (colFecha >= 0 ? row.cells[colFecha] : "").trim();

      if (!pozo) errs.push("Pozo requerido");
      if (!fecha) errs.push("Fecha requerida");
      else if (!isValidScenarioDate(fecha)) {
        errs.push("Fecha debe ser YYYY-MM-DD, YYYY-MM o MM-YYYY");
      }

      const petroleo =
        colPetroleo >= 0 ? String(row.cells[colPetroleo] ?? "").trim() : "";
      const agua = colAgua >= 0 ? String(row.cells[colAgua] ?? "").trim() : "";
      const gas = colGas >= 0 ? String(row.cells[colGas] ?? "").trim() : "";
      const inyGas =
        colInyGas >= 0 ? String(row.cells[colInyGas] ?? "").trim() : "";
      const inyAgua =
        colInyAgua >= 0 ? String(row.cells[colInyAgua] ?? "").trim() : "";

      const metrics = [petroleo, agua, gas, inyGas, inyAgua];
      if (metrics.every((m) => !m)) errs.push("Al menos una metrica requerida");

      if (petroleo && !Number.isFinite(toNumberFlexible(petroleo))) {
        errs.push("petroleo debe ser numerico");
      }
      if (agua && !Number.isFinite(toNumberFlexible(agua))) {
        errs.push("agua debe ser numerico");
      }
      if (gas && !Number.isFinite(toNumberFlexible(gas))) {
        errs.push("gas debe ser numerico");
      }
      if (inyGas && !Number.isFinite(toNumberFlexible(inyGas))) {
        errs.push("inyeccionGas debe ser numerico");
      }
      if (inyAgua && !Number.isFinite(toNumberFlexible(inyAgua))) {
        errs.push("inyeccionAgua debe ser numerico");
      }

      const key =
        fecha && pozo
          ? `${pozo.toLowerCase()}::${capa.toLowerCase()}::${fecha}`
          : "";
      if (key) {
        if (seen.has(key)) errs.push("Duplicado logico en filas seleccionadas");
        else seen.add(key);
      }
    }

    if (errs.length) rowErrors[idx] = errs;
  });

  return rowErrors;
}
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

function buildEscenarioContentFromState(
  state: ImportTableState<"Escenario">,
): string {
  const selectedCols = state.columns
    .map((_, idx) => idx)
    .filter(
      (idx) =>
        state.selectedCols[idx] &&
        (state.mapping[idx] ?? "__ignore__") !== "__ignore__",
    );

  const header = selectedCols.map((idx) => state.mapping[idx]).join("\t");
  const lines: string[] = [header];

  const selectedRows = getSelectedRows(state.rows, state.selectedRows);

  for (const row of selectedRows) {
    const line = selectedCols
      .map((idx) => String(row.cells[idx] ?? "").trim())
      .join("\t");
    lines.push(line);
  }

  return lines.join("\n");
}

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

function recomputeImportState<E extends ImportEntity>(
  current: ImportTableState<E>,
  ent: E,
  nextRows?: TxtRow[],
  nextSelectedRows?: boolean[],
  nextSelectedCols?: boolean[],
  nextMapping?: ColumnMapping<E>[],
): ImportTableState<E> {
  const rows = nextRows ?? current.rows;
  const selectedRows = nextSelectedRows ?? current.selectedRows;
  const selectedCols = nextSelectedCols ?? current.selectedCols;
  const mapping = nextMapping ?? current.mapping;

  const effMapping = getEffectiveMapping(mapping, selectedCols);
  const mappingErrors = validateMapping(ent as any, effMapping as any);
  const rowErrors =
    mappingErrors.length === 0
      ? validateRows(ent as any, rows, effMapping as any, selectedRows)
      : {};

  return {
    ...current,
    rows,
    selectedRows,
    selectedCols,
    mapping,
    mappingErrors,
    rowErrors,
  };
}

export const useNewProjectWizardStore = create<NewProjectWizardState>(
  (set, get) => ({
    step: "proyecto",
    draft: initialDraft(),
    proyecto: null,

    capasFile: null,
    pozosFile: null,
    pozoCapaFile: null,
    scenarioFile: null,

    capasImport: emptyImportState("Capa"),
    pozosImport: emptyImportState("Pozo"),
    pozoCapaImport: emptyImportState("PozoCapa"),
    scenarioImport: emptyImportState("Escenario"),

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

    setScenarioFile: (scenarioFile) =>
      set({
        scenarioFile,
        scenarioImport: emptyImportState("Escenario"),
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
            ? validateRows(
                "Capa",
                parsed.rows,
                effMapping as any,
                initSelectedRows,
              )
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
        return;
      }

      if (entity === "Pozo") {
        const mapping = autoMappingForEntity("Pozo", parsed.columns);
        const effMapping = getEffectiveMapping(mapping, initSelectedCols);
        const mappingErrors = validateMapping("Pozo", effMapping as any);
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows(
                "Pozo",
                parsed.rows,
                effMapping as any,
                initSelectedRows,
              )
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
        return;
      }

      if (entity === "PozoCapa") {
        const mapping = autoMappingForEntity("PozoCapa", parsed.columns);
        const effMapping = getEffectiveMapping(mapping, initSelectedCols);
        const mappingErrors = validateMapping("PozoCapa", effMapping as any);
        const rowErrors =
          mappingErrors.length === 0
            ? validateRows(
                "PozoCapa",
                parsed.rows,
                effMapping as any,
                initSelectedRows,
              )
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
        return;
      }

      const mapping = autoMappingForEntity("Escenario", parsed.columns);
      const effMapping = getEffectiveMapping(mapping, initSelectedCols);
      const mappingErrors = validateMapping("Escenario", effMapping as any);
      const rowErrors =
        mappingErrors.length === 0
          ? validateRows(
              "Escenario",
              parsed.rows,
              effMapping as any,
              initSelectedRows,
            )
          : {};

      set({
        scenarioImport: {
          entity: "Escenario",
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
    },

    setImportMapping: (entity, colIndex, mappingValue) => {
      const recompute = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const mapping = [...current.mapping] as any[];
        if (colIndex < 0 || colIndex >= mapping.length) return current;
        mapping[colIndex] = mappingValue as any;

        return recomputeImportState(
          current,
          ent,
          undefined,
          undefined,
          undefined,
          mapping as any,
        );
      };

      if (entity === "Capa") {
        set({ capasImport: recompute(get().capasImport, "Capa") as any });
        return;
      }
      if (entity === "Pozo") {
        set({ pozosImport: recompute(get().pozosImport, "Pozo") as any });
        return;
      }
      if (entity === "PozoCapa") {
        set({
          pozoCapaImport: recompute(get().pozoCapaImport, "PozoCapa") as any,
        });
        return;
      }
      set({
        scenarioImport: recompute(get().scenarioImport, "Escenario") as any,
      });
    },

    setImportCell: (entity, rowIndex, colIndex, value) => {
      const update = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const rows = [...current.rows];
        if (!rows[rowIndex]) return { current, changed: false };

        const cells = [...rows[rowIndex].cells];
        if (colIndex < 0 || colIndex >= cells.length) {
          return { current, changed: false };
        }

        cells[colIndex] = value;
        rows[rowIndex] = { ...rows[rowIndex], cells };

        return {
          current: recomputeImportState(current, ent, rows),
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
      if (entity === "PozoCapa") {
        const res = update(get().pozoCapaImport, "PozoCapa");
        if (res.changed) set({ pozoCapaImport: res.current as any });
        return;
      }

      const res = update(get().scenarioImport, "Escenario");
      if (res.changed) set({ scenarioImport: res.current as any });
    },

    replaceImportValue: (
      entity,
      colIndex,
      fromValue,
      toValue,
      onlySelectedRows = true,
    ) => {
      const normalizedFrom = String(fromValue ?? "");
      const normalizedTo = String(toValue ?? "");

      const apply = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        if (colIndex < 0 || colIndex >= current.columns.length) {
          return { next: current, replaced: 0 };
        }

        let replaced = 0;

        const rows = current.rows.map((row, rowIndex) => {
          const shouldCheck = onlySelectedRows
            ? (current.selectedRows[rowIndex] ?? true)
            : true;

          if (!shouldCheck) return row;

          const currentValue = String(row.cells[colIndex] ?? "");
          if (currentValue !== normalizedFrom) return row;

          const cells = [...row.cells];
          cells[colIndex] = normalizedTo;
          replaced += 1;

          return { ...row, cells };
        });

        if (replaced === 0) {
          return { next: current, replaced: 0 };
        }

        return {
          next: recomputeImportState(current, ent, rows),
          replaced,
        };
      };

      if (entity === "Capa") {
        const res = apply(get().capasImport, "Capa");
        if (res.replaced > 0) set({ capasImport: res.next as any });
        return res.replaced;
      }

      if (entity === "Pozo") {
        const res = apply(get().pozosImport, "Pozo");
        if (res.replaced > 0) set({ pozosImport: res.next as any });
        return res.replaced;
      }

      if (entity === "PozoCapa") {
        const res = apply(get().pozoCapaImport, "PozoCapa");
        if (res.replaced > 0) set({ pozoCapaImport: res.next as any });
        return res.replaced;
      }

      const res = apply(get().scenarioImport, "Escenario");
      if (res.replaced > 0) set({ scenarioImport: res.next as any });
      return res.replaced;
    },

    setImportRowSelected: (entity, rowIndex, selected) => {
      const apply = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const selectedRows = [...current.selectedRows];
        if (rowIndex < 0 || rowIndex >= selectedRows.length) return current;

        selectedRows[rowIndex] = selected;

        return recomputeImportState(
          current,
          ent,
          undefined,
          selectedRows,
          undefined,
          undefined,
        );
      };

      if (entity === "Capa") {
        set({ capasImport: apply(get().capasImport, "Capa") as any });
      } else if (entity === "Pozo") {
        set({ pozosImport: apply(get().pozosImport, "Pozo") as any });
      } else if (entity === "PozoCapa") {
        set({ pozoCapaImport: apply(get().pozoCapaImport, "PozoCapa") as any });
      } else {
        set({
          scenarioImport: apply(get().scenarioImport, "Escenario") as any,
        });
      }
    },

    setImportColSelected: (entity, colIndex, selected) => {
      const apply = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const selectedCols = [...current.selectedCols];
        if (colIndex < 0 || colIndex >= selectedCols.length) return current;
        selectedCols[colIndex] = selected;

        return recomputeImportState(
          current,
          ent,
          undefined,
          undefined,
          selectedCols,
          undefined,
        );
      };

      if (entity === "Capa") {
        set({ capasImport: apply(get().capasImport, "Capa") as any });
      } else if (entity === "Pozo") {
        set({ pozosImport: apply(get().pozosImport, "Pozo") as any });
      } else if (entity === "PozoCapa") {
        set({ pozoCapaImport: apply(get().pozoCapaImport, "PozoCapa") as any });
      } else {
        set({
          scenarioImport: apply(get().scenarioImport, "Escenario") as any,
        });
      }
    },

    setImportAllRowsSelected: (entity, selected) => {
      const apply = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const selectedRows = current.rows.map(() => selected);
        return recomputeImportState(
          current,
          ent,
          undefined,
          selectedRows,
          undefined,
          undefined,
        );
      };

      if (entity === "Capa") {
        set({ capasImport: apply(get().capasImport, "Capa") as any });
      } else if (entity === "Pozo") {
        set({ pozosImport: apply(get().pozosImport, "Pozo") as any });
      } else if (entity === "PozoCapa") {
        set({ pozoCapaImport: apply(get().pozoCapaImport, "PozoCapa") as any });
      } else {
        set({
          scenarioImport: apply(get().scenarioImport, "Escenario") as any,
        });
      }
    },

    setImportAllColsSelected: (entity, selected) => {
      const apply = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const selectedCols = current.columns.map(() => selected);
        return recomputeImportState(
          current,
          ent,
          undefined,
          undefined,
          selectedCols,
          undefined,
        );
      };

      if (entity === "Capa") {
        set({ capasImport: apply(get().capasImport, "Capa") as any });
      } else if (entity === "Pozo") {
        set({ pozosImport: apply(get().pozosImport, "Pozo") as any });
      } else if (entity === "PozoCapa") {
        set({ pozoCapaImport: apply(get().pozoCapaImport, "PozoCapa") as any });
      } else {
        set({
          scenarioImport: apply(get().scenarioImport, "Escenario") as any,
        });
      }
    },

    validateImport: (entity) => {
      const run = <E extends ImportEntity>(
        current: ImportTableState<E>,
        ent: E,
      ) => {
        const next = recomputeImportState(current, ent);
        const ok =
          next.mappingErrors.length === 0 &&
          Object.keys(next.rowErrors).length === 0;
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
      if (entity === "PozoCapa") {
        const { next, ok } = run(get().pozoCapaImport, "PozoCapa");
        set({ pozoCapaImport: next as any });
        return ok;
      }

      const { next, ok } = run(get().scenarioImport, "Escenario");
      set({ scenarioImport: next as any });
      return ok;
    },

    buildContentForCommit: (entity) => {
      if (entity === "Capa") {
        return buildCapasContentFromState(get().capasImport);
      }
      if (entity === "Pozo") {
        return buildPozosContentFromState(get().pozosImport);
      }
      if (entity === "PozoCapa") {
        return buildPozoCapaContentFromState(get().pozoCapaImport);
      }
      return buildEscenarioContentFromState(get().scenarioImport);
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

      set({
        capasImport: recomputeImportState(st, "Capa", rows),
      });
    },

    clearImport: (entity) => {
      if (entity === "Capa") set({ capasImport: emptyImportState("Capa") });
      if (entity === "Pozo") set({ pozosImport: emptyImportState("Pozo") });
      if (entity === "PozoCapa") {
        set({ pozoCapaImport: emptyImportState("PozoCapa") });
      }
      if (entity === "Escenario") {
        set({ scenarioImport: emptyImportState("Escenario") });
      }
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
        scenarioFile: null,

        capasImport: emptyImportState("Capa"),
        pozosImport: emptyImportState("Pozo"),
        pozoCapaImport: emptyImportState("PozoCapa"),
        scenarioImport: emptyImportState("Escenario"),

        loading: false,
        error: "",
      }),
  }),
);










