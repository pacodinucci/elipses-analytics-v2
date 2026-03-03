// src/store/bubbles-style.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BubblesStyleConfig as EngineBubblesStyleConfig } from "../viewer/engine/layers/bubbles/bubbles-layer";

export type BubblesStyleConfig = EngineBubblesStyleConfig;

/**
 * v2 (ValorEscenario): petroleo, agua, gas, inyeccionAgua, inyeccionGas
 * Nota: si querés compat con v1, hacelo en el hook que arma los bubbles,
 * mapeando aguaIny -> inyeccionAgua.
 */
export type BubbleMetric =
  | "petroleo"
  | "agua"
  | "gas"
  | "inyeccionAgua"
  | "inyeccionGas";

type BubblesStyleState = {
  metric: BubbleMetric;
  config: EngineBubblesStyleConfig;
  setMetric: (metric: BubbleMetric) => void;
  setConfig: (
    updater:
      | EngineBubblesStyleConfig
      | ((prev: EngineBubblesStyleConfig) => EngineBubblesStyleConfig),
  ) => void;
  reset: () => void;
};

const DEFAULT_CONFIG: EngineBubblesStyleConfig = {
  enabled: true,
  hideNull: true,

  color: "#22c55e",
  opacity: 0.6,
  borderColor: "#1f2937",
  borderWidth: 2,

  scaleMode: "sqrt",
  domain: { mode: "auto", min: 0, max: 1 },

  minRadius: 2,
  maxRadius: 24,

  // ✅ defaults PIE (v2)
  renderMode: "circle",
  pieKeys: ["petroleo", "agua", "gas", "inyeccionAgua", "inyeccionGas"],
  pieColors: {
    petroleo: "#2b2b2b",
    agua: "#2f80ed",
    gas: "#f2c94c",
    inyeccionAgua: "#56ccf2",
    inyeccionGas: "#9b51e0",
  },
  pieMinTotal: 0,
  pieInnerRadiusRatio: 0,
};

export const useBubblesStyle = create<BubblesStyleState>()(
  persist(
    (set, get) => ({
      metric: "petroleo",
      config: DEFAULT_CONFIG,

      setMetric: (metric) => set({ metric }),

      setConfig: (updater) => {
        const prev = get().config;
        const next =
          typeof updater === "function"
            ? (
                updater as (
                  p: EngineBubblesStyleConfig,
                ) => EngineBubblesStyleConfig
              )(prev)
            : updater;

        set({ config: next });
      },

      reset: () => set({ metric: "petroleo", config: DEFAULT_CONFIG }),
    }),
    {
      name: "elipsis:bubbles-style",
      version: 4, // ✅ BUMP (antes 3)
    },
  ),
);
