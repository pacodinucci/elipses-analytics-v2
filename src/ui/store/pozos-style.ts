// src/store/pozos-style.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PozoSymbol = "circle" | "square" | "triangle-up";

// estados: -1 no existe, 0 cerrado, 1 productor abierto, 2 inyector abierto
export type PozoEstado = -1 | 0 | 1 | 2;

export type PozoStyle = {
  enabled: boolean;

  size: number;
  color: string;
  opacity: number;

  borderColor: string;
  borderWidth: number;

  symbol: PozoSymbol;

  // Etiquetas
  labelsEnabled: boolean;
  labelFontSize: number;
  labelOpacity: number;
  labelDx: number;
  labelDy: number;
  labelMaxCount: number; // 0 = sin límite
};

export const DEFAULT_POZO_STYLE: PozoStyle = {
  enabled: true,

  size: 5,
  color: "#a0a0a0",
  opacity: 0.9,

  borderColor: "#000000",
  borderWidth: 1,

  symbol: "circle",

  labelsEnabled: false,
  labelFontSize: 10,
  labelOpacity: 0.9,
  labelDx: 6,
  labelDy: 6,
  labelMaxCount: 0,
};

// =====================================================
// Config para estilo uniforme vs por estado
// =====================================================

export type PozosStyleMode = "uniform" | "byState";

export type PozosStyleConfig = {
  mode: PozosStyleMode;

  // estilo base (uniform lo usa directo; byState usa como fallback)
  base: PozoStyle;

  // overrides por estado (solo lo que quieras sobrescribir)
  byState: Partial<Record<PozoEstado, Partial<PozoStyle>>>;

  // filtros de render
  hideClosed: boolean; // estado 0
  hideNonexistent: boolean; // estado -1
};

export const DEFAULT_POZOS_STYLE_CONFIG: PozosStyleConfig = {
  mode: "uniform",
  base: DEFAULT_POZO_STYLE,
  byState: {
    1: { color: "#16a34a", symbol: "circle" }, // productor abierto
    2: { color: "#2563eb", symbol: "triangle-up" }, // inyector abierto
    0: { color: "#64748b", symbol: "square", opacity: 0.7 }, // cerrado
    [-1]: {}, // no existe (normalmente se oculta)
  },
  hideClosed: false,
  hideNonexistent: true,
};

// =====================================================
// Helpers (evitar referencias compartidas)
// =====================================================

function clonePozoStyle(s: PozoStyle): PozoStyle {
  return { ...s };
}

function cloneByState(
  byState: PozosStyleConfig["byState"],
): PozosStyleConfig["byState"] {
  const out: PozosStyleConfig["byState"] = {};
  for (const k in byState) {
    if (!Object.prototype.hasOwnProperty.call(byState, k)) continue;
    const key = Number(k) as PozoEstado;
    const ov = byState[key];
    out[key] = ov ? { ...ov } : ov;
  }
  return out;
}

export function clonePozosStyleConfig(cfg: PozosStyleConfig): PozosStyleConfig {
  return {
    ...cfg,
    base: clonePozoStyle(cfg.base),
    byState: cloneByState(cfg.byState ?? {}),
  };
}

function makeDefaultPozosStyleConfig(): PozosStyleConfig {
  // ✅ default sin referencias compartidas
  return clonePozosStyleConfig({
    ...DEFAULT_POZOS_STYLE_CONFIG,
    base: DEFAULT_POZO_STYLE,
    byState: DEFAULT_POZOS_STYLE_CONFIG.byState,
  });
}

// =====================================================
// Zustand store
// =====================================================

type PozosStyleState = {
  pozosStyleConfig: PozosStyleConfig;

  setPozosStyleConfig: (
    updater: PozosStyleConfig | ((prev: PozosStyleConfig) => PozosStyleConfig),
  ) => void;

  resetPozosStyleConfig: () => void;
};

export const usePozosStyle = create<PozosStyleState>()(
  persist(
    (set) => ({
      pozosStyleConfig: makeDefaultPozosStyleConfig(),

      setPozosStyleConfig: (updater) =>
        set((s) => {
          const next =
            typeof updater === "function"
              ? (updater as (p: PozosStyleConfig) => PozosStyleConfig)(
                  s.pozosStyleConfig,
                )
              : updater;

          // ✅ por seguridad, evitamos que entre un objeto con refs raras
          return { pozosStyleConfig: clonePozosStyleConfig(next) };
        }),

      resetPozosStyleConfig: () =>
        set({
          pozosStyleConfig: makeDefaultPozosStyleConfig(),
        }),
    }),
    {
      name: "pozos-style-v2",
      version: 1,
      // migrate: (persisted: any, fromVersion) => {
      //   // Si alguna vez cambia el shape, migrás acá.
      //   // Por ahora lo dejamos como passthrough robusto:
      //   if (!persisted?.pozosStyleConfig) {
      //     return { pozosStyleConfig: makeDefaultPozosStyleConfig() };
      //   }
      //   return {
      //     ...persisted,
      //     pozosStyleConfig: clonePozosStyleConfig(persisted.pozosStyleConfig),
      //   };
      // },
    },
  ),
);
