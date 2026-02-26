import { create } from "zustand";
import type { PozoPoint, Elipse } from "../types/mapa";

export type MapKey = string;

export type MapaDisplayedSnapshot = {
  key: MapKey;

  // ✅ v2: todo cuelga de proyecto (no existe yacimiento)
  proyectoId: string | null;

  capa: string | null;
  variable: string | null;
  fecha: string | null; // YYYY-MM-DD

  showMapa: boolean;
  showPozos: boolean;
  showElipses: boolean;

  pozos: PozoPoint[];
  elipses: Elipse[];
  elipseVariables: string[];

  /**
   * ⚠️ v2: "producción" como entidad ya no existe.
   * Si tu UI todavía la usa, migrala a Escenario/ValorEscenario en otro paso.
   * Por ahora la sacamos del snapshot para que el store refleje el modelo nuevo.
   */
  updatedAt: number;
};

type MapaDisplayState = {
  activeKey: MapKey | null;
  byKey: Record<MapKey, MapaDisplayedSnapshot>;

  makeKey: (args: {
    proyectoId: string | null;
    capa: string | null;
    variable: string | null;
  }) => MapKey;

  setActiveKey: (key: MapKey | null) => void;

  upsert: (snap: Omit<MapaDisplayedSnapshot, "updatedAt">) => void;
  clear: (key: MapKey) => void;
  clearAll: () => void;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

export const useMapaDisplayStore = create<MapaDisplayState>((set) => ({
  activeKey: null,
  byKey: {},

  // ✅ v2: key estable sin yacimiento
  makeKey: ({ proyectoId, capa, variable }) => {
    const p = proyectoId ?? "no-proyecto";
    const c = capa ? normalizeName(capa) : "no-capa";
    const v = variable ?? "no-var";
    return `${p}|${c}|${v}`;
  },

  setActiveKey: (key) => set({ activeKey: key }),

  upsert: (snap) =>
    set((s) => ({
      byKey: {
        ...s.byKey,
        [snap.key]: { ...snap, updatedAt: Date.now() },
      },
    })),

  clear: (key) =>
    set((s) => {
      const { [key]: _, ...rest } = s.byKey;
      return {
        byKey: rest,
        activeKey: s.activeKey === key ? null : s.activeKey,
      };
    }),

  clearAll: () => set({ byKey: {}, activeKey: null }),
}));
