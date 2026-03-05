// src/ui/lib/name-resolver.ts
import { keysForName } from "./normalize-name";

export type NameEntity = { id: string; nombre: string };

export type ResolverIndex = {
  map: Map<string, string[]>; // key -> ids (si hay >1 => ambiguo)
};

export type ResolveResult =
  | { ok: true; id: string; keyUsed: string }
  | { ok: false; reason: "missing"; tried: string[] }
  | { ok: false; reason: "ambiguous"; tried: string[]; candidates: string[] };

export function buildResolverIndex(items: NameEntity[]): ResolverIndex {
  const map = new Map<string, string[]>();

  for (const it of items) {
    const id = String(it.id);
    const nombre = String(it.nombre ?? "");
    const keys = keysForName(nombre);

    for (const k of keys) {
      const arr = map.get(k);
      if (!arr) map.set(k, [id]);
      else if (!arr.includes(id)) arr.push(id);
    }
  }

  return { map };
}

export function resolveNameToId(
  index: ResolverIndex,
  inputName: string,
): ResolveResult {
  const tried = keysForName(inputName);

  for (const k of tried) {
    const ids = index.map.get(k);
    if (!ids || ids.length === 0) continue;

    if (ids.length === 1) return { ok: true, id: ids[0], keyUsed: k };

    return {
      ok: false,
      reason: "ambiguous",
      tried,
      candidates: ids.slice(),
    };
  }

  return { ok: false, reason: "missing", tried };
}

export type PozoCapaRowResolved = {
  rowIndex: number; // índice 0-based en st.rows (clave para filtrar tabla)
  rowNumber: number;
  pozoId: string;
  capaId: string;
  tope: number;
  base: number;
};

export type PozoCapaResolveReport = {
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
  invalidDepth: Array<{
    rowIndex: number;
    rowNumber: number;
    tope: string;
    base: string;
  }>;

  unresolvedRowIndices: number[];
  rows: PozoCapaRowResolved[];
};

export function resolvePozoCapaRows(args: {
  rows: { rowNumber: number; cells: string[] }[];
  selectedRows: boolean[];
  colPozo: number;
  colCapa: number;
  colTope: number;
  colBase: number;
  pozoIndex: ResolverIndex;
  capaIndex: ResolverIndex;
}): PozoCapaResolveReport {
  const {
    rows,
    selectedRows,
    colPozo,
    colCapa,
    colTope,
    colBase,
    pozoIndex,
    capaIndex,
  } = args;

  const report: PozoCapaResolveReport = {
    ok: true,
    totalSelected: 0,
    resolved: 0,

    missingPozos: [],
    missingCapas: [],
    ambiguousPozos: [],
    ambiguousCapas: [],
    invalidDepth: [],

    unresolvedRowIndices: [],
    rows: [],
  };

  const unresolved = new Set<number>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (!selectedRows[rowIndex]) continue;

    report.totalSelected += 1;

    const r = rows[rowIndex];
    const pozoName = (r.cells[colPozo] ?? "").trim();
    const capaName = (r.cells[colCapa] ?? "").trim();
    const topeStr = (r.cells[colTope] ?? "").trim().replace(",", ".");
    const baseStr = (r.cells[colBase] ?? "").trim().replace(",", ".");

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

    if (!capaName) {
      report.ok = false;
      unresolved.add(rowIndex);
      report.missingCapas.push({
        rowIndex,
        rowNumber: r.rowNumber,
        capaName: "",
      });
      continue;
    }

    const tope = Number(topeStr);
    const base = Number(baseStr);

    if (!Number.isFinite(tope) || !Number.isFinite(base)) {
      report.ok = false;
      unresolved.add(rowIndex);
      report.invalidDepth.push({
        rowIndex,
        rowNumber: r.rowNumber,
        tope: topeStr,
        base: baseStr,
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

    report.resolved += 1;
    report.rows.push({
      rowIndex,
      rowNumber: r.rowNumber,
      pozoId: rp.id,
      capaId: rc.id,
      tope,
      base,
    });
  }

  report.unresolvedRowIndices = Array.from(unresolved.values());
  return report;
}
