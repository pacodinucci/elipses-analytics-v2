// src/store/viewer-elipses-store.ts
import { create } from "zustand";
import type { ElipseRow } from "../viewer/engine/layers/elipses/ellipses-polygons-layer";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

type LoadAllArgs = {
  /**
   * ✅ v2: id operativo del contexto.
   * (antes yacimientoId; ahora proyectoId)
   */
  proyectoId: string;

  capas: string[];
};

type ViewerElipsesStore = {
  // contexto actual
  proyectoId: string | null;

  // mismo formato que consume el hook
  byCapa: Record<string, ElipseRow[]>;

  // progreso / estado
  loading: boolean;
  error: string | null;
  totalCapas: number;
  loadedCapas: number;

  // anti race-condition
  requestId: number;

  requested: Record<string, true>;

  isReady: () => boolean;

  reset: () => void;

  /**
   * ✅ Compat MVP:
   * - todavía NO tenemos simulacionId seleccionado
   * - preload v2 NO expone loadElipses legacy
   * => este loadAll queda como placeholder que no rompe UI.
   */
  loadAll: (args: LoadAllArgs) => Promise<void>;
};

export const useViewerElipsesStore = create<ViewerElipsesStore>((set, get) => ({
  proyectoId: null,
  byCapa: {},

  loading: false,
  error: null,
  totalCapas: 0,
  loadedCapas: 0,

  requestId: 0,
  requested: {},

  isReady: () => {
    const s = get();
    return (
      !!s.proyectoId &&
      !s.loading &&
      !s.error &&
      s.totalCapas >= 0 &&
      s.loadedCapas === s.totalCapas
    );
  },

  reset: () => {
    const nextRid = get().requestId + 1;

    set({
      proyectoId: null,
      byCapa: {},
      loading: false,
      error: null,
      totalCapas: 0,
      loadedCapas: 0,
      requested: {},
      requestId: nextRid,
    });
  },

  loadAll: async ({ proyectoId, capas }) => {
    const rid = get().requestId + 1;

    const capaNames = (capas ?? [])
      .map((c) => (c ?? "").trim())
      .filter(Boolean);
    const keys = capaNames.map(normalizeName);

    // inicializar estado
    set({
      proyectoId,
      byCapa: {},
      loading: true,
      error: null,
      totalCapas: capaNames.length,
      loadedCapas: 0,
      requested: {},
      requestId: rid,
    });

    // Si no hay capas, marcamos listo
    if (capaNames.length === 0) {
      set((s) => {
        if (s.requestId !== rid) return s;
        return { ...s, loading: false, error: null };
      });
      return;
    }

    try {
      /**
       * ✅ PLACEHOLDER COMPAT:
       * sin simulacionId aún, no hay fuente v2 para elipses.
       * para no romper el front, llenamos byCapa con arrays vacíos por capa,
       * y marcamos el progreso como completo.
       */
      const emptyByCapa: Record<string, ElipseRow[]> = {};
      const requested: Record<string, true> = {};

      for (let i = 0; i < capaNames.length; i++) {
        if (get().requestId !== rid) return;
        const key = keys[i];
        requested[key] = true;
        emptyByCapa[key] = [];
      }

      if (get().requestId !== rid) return;

      set({
        byCapa: emptyByCapa,
        requested,
        loadedCapas: capaNames.length,
        loading: false,
        error: null,
      });

      console.log(
        "⚠️ [viewer-elipses-store] loadAll COMPAT (sin simulacionId)",
        {
          proyectoId,
          capas: capaNames.length,
        },
      );
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Error desconocido cargando elipses";
      console.error("[viewer-elipses-store] loadAll", e);

      if (get().requestId !== rid) return;

      set({ loading: false, error: msg });
    }
  },
}));
