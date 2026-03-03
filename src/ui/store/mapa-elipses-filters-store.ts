// src/ui/store/mapa-elipses-filters-store.ts
import { create } from "zustand";
import type { MapKey } from "./mapa-display-store";

export type FilterOp = ">" | ">=" | "<" | "<=" | "=" | "!=";

export type ElipsesFilterRow = {
  id: string;
  /**
   * En v2 esto debería representar el ElipseVariable.id (o el "codigo"),
   * según cómo lo estés resolviendo en el UI.
   */
  variable: string | null;
  op: FilterOp;
  value: string; // UI-first. luego lo parseás a number/etc.
};

export type ElipsesFiltersStateForKey = {
  /**
   * Semántica sugerida en v2:
   * - "historical" puede mapear a "escenario histórico" o a "baseline".
   * Pero el store no necesita conocer el dominio; eso lo decide el selector/consulta.
   */
  showHistorical: boolean;
  rows: ElipsesFilterRow[];
  updatedAt: number;
};

type State = {
  byKey: Record<MapKey, ElipsesFiltersStateForKey>;

  ensure: (key: MapKey) => void;

  setShowHistorical: (key: MapKey, value: boolean) => void;

  setRows: (key: MapKey, rows: ElipsesFilterRow[]) => void;
  addRow: (key: MapKey) => void;
  removeRow: (key: MapKey, rowId: string) => void;

  clear: (key: MapKey) => void;
  clearAll: () => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_ROWS: ElipsesFilterRow[] = [
  { id: "r1", variable: null, op: ">", value: "" },
];

function cloneDefaultRows(): ElipsesFilterRow[] {
  // evita compartir referencias (bug común)
  return DEFAULT_ROWS.map((r) => ({ ...r }));
}

function defaultForKey(): ElipsesFiltersStateForKey {
  return {
    showHistorical: false,
    rows: cloneDefaultRows(),
    updatedAt: Date.now(),
  };
}

export const useMapaElipsesFiltersStore = create<State>((set, get) => ({
  byKey: {},

  ensure: (key) =>
    set((s) => {
      if (s.byKey[key]) return s;
      return { byKey: { ...s.byKey, [key]: defaultForKey() } };
    }),

  setShowHistorical: (key, value) =>
    set((s) => ({
      byKey: {
        ...s.byKey,
        [key]: {
          ...(s.byKey[key] ?? defaultForKey()),
          showHistorical: value,
          updatedAt: Date.now(),
        },
      },
    })),

  setRows: (key, rows) =>
    set((s) => ({
      byKey: {
        ...s.byKey,
        [key]: {
          ...(s.byKey[key] ?? defaultForKey()),
          rows: rows.length ? rows : cloneDefaultRows(),
          updatedAt: Date.now(),
        },
      },
    })),

  addRow: (key) => {
    const cur = get().byKey[key] ?? defaultForKey();
    const nextRow: ElipsesFilterRow = {
      id: `r_${uid()}`,
      variable: null,
      op: ">",
      value: "",
    };

    set((s) => ({
      byKey: {
        ...s.byKey,
        [key]: {
          ...cur,
          rows: [...cur.rows, nextRow],
          updatedAt: Date.now(),
        },
      },
    }));
  },

  removeRow: (key, rowId) => {
    const cur = get().byKey[key] ?? defaultForKey();
    const next = cur.rows.filter((r) => r.id !== rowId);

    set((s) => ({
      byKey: {
        ...s.byKey,
        [key]: {
          ...cur,
          rows: next.length ? next : cloneDefaultRows(),
          updatedAt: Date.now(),
        },
      },
    }));
  },

  clear: (key) =>
    set((s) => ({
      byKey: { ...s.byKey, [key]: defaultForKey() },
    })),

  clearAll: () => set({ byKey: {} }),
}));
