import type {
  ImportKind,
  ImportProgress,
  InvalidBulkReplaceGroup,
  InvalidCellsMap,
} from "./import-modal.types";

export function scenarioFieldOptionsForType(tipoEscenarioId: string) {
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

export function parseNullableMetric(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function isValidISODate(value: string): boolean {
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

export function normalizeScenarioDate(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (isValidISODate(value)) {
    return value;
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

export function buildScenarioLogicalKey(
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

export function groupRowsByLabel<T extends { rowIndex: number }>(
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

export function buildInvalidBulkReplaceGroups(
  rows: Array<{ cells: string[] }>,
  columns: string[],
  invalidCells: InvalidCellsMap,
): InvalidBulkReplaceGroup[] {
  const groups = new Map<
    string,
    { value: string; colIndex: number; rowIndices: Set<number> }
  >();

  for (const key of Object.keys(invalidCells ?? {})) {
    const [rowPart, colPart] = key.split(":");
    const rowIndex = Number(rowPart);
    const colIndex = Number(colPart);

    if (!Number.isInteger(rowIndex) || !Number.isInteger(colIndex)) continue;

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
        (a, b) => a - b,
      );

      return {
        id,
        label: item.value.trim() || "(vacío)",
        value: item.value,
        colIndex: item.colIndex,
        colLabel,
        rowIndices,
        count: rowIndices.length,
      };
    })
    .sort((a, b) => b.count - a.count || a.colLabel.localeCompare(b.colLabel));
}

export function buildInitialProgress(kind: ImportKind): ImportProgress {
  return {
    visible: true,
    kind,
    phase: "preparing",
    current: 0,
    total: 0,
    message: "Preparando importación...",
  };
}

export function getProgressPercent(progress: ImportProgress | null): number {
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
