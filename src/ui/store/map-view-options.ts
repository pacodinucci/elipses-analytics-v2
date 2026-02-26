// src/store/map-view-options.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type MapViewOptionsState = {
  // --------------------
  // Visibilidad de capas
  // --------------------
  showMapa: boolean;
  showPozos: boolean;
  showElipses: boolean;
  showNavigator: boolean;

  // ✅ BUBBLES
  showBubbles: boolean;

  // --------------------
  // Zoom global persistente
  // --------------------
  xRange: [number, number] | null;
  yRange: [number, number] | null;

  // --------------------
  // Flags legacy / dataset
  // --------------------
  showElipsesFw: boolean;
  showElipsesWiPrev: boolean;

  // --------------------
  // Setters / toggles
  // --------------------
  setShowMapa: (v: boolean) => void;
  setShowPozos: (v: boolean) => void;
  setShowElipses: (v: boolean) => void;
  setShowNavigator: (v: boolean) => void;

  // ✅ BUBBLES
  setShowBubbles: (v: boolean) => void;

  toggleMapa: () => void;
  togglePozos: () => void;
  toggleElipses: () => void;
  toggleNavigator: () => void;

  // ✅ BUBBLES
  toggleBubbles: () => void;

  // --------------------
  // Zoom
  // --------------------
  setZoom: (x: [number, number], y: [number, number]) => void;
  resetZoom: () => void;

  // --------------------
  // Elipses (legacy)
  // --------------------
  setShowElipsesFw: (v: boolean) => void;
  setShowElipsesWiPrev: (v: boolean) => void;
  toggleElipsesFw: () => void;
  toggleElipsesWiPrev: () => void;
};

const DEFAULTS: Omit<
  MapViewOptionsState,
  | "setShowMapa"
  | "setShowPozos"
  | "setShowElipses"
  | "setShowNavigator"
  | "setShowBubbles"
  | "toggleMapa"
  | "togglePozos"
  | "toggleElipses"
  | "toggleNavigator"
  | "toggleBubbles"
  | "setZoom"
  | "resetZoom"
  | "setShowElipsesFw"
  | "setShowElipsesWiPrev"
  | "toggleElipsesFw"
  | "toggleElipsesWiPrev"
> = {
  showMapa: true,
  showPozos: true,
  showElipses: false,
  showNavigator: false,

  // ✅ BUBBLES
  showBubbles: false,

  xRange: null,
  yRange: null,

  showElipsesFw: true,
  showElipsesWiPrev: false,
};

function isTupleRange(v: any): v is [number, number] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

export const useMapViewOptions = create<MapViewOptionsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      // --------------------
      // Visibility
      // --------------------
      setShowMapa: (v) => set({ showMapa: !!v }),
      setShowPozos: (v) => set({ showPozos: !!v }),
      setShowElipses: (v) => set({ showElipses: !!v }),
      setShowNavigator: (v) => set({ showNavigator: !!v }),

      // ✅ BUBBLES
      setShowBubbles: (v) => set({ showBubbles: !!v }),

      toggleMapa: () => set((s) => ({ showMapa: !s.showMapa })),
      togglePozos: () => set((s) => ({ showPozos: !s.showPozos })),
      toggleElipses: () => set((s) => ({ showElipses: !s.showElipses })),
      toggleNavigator: () => set((s) => ({ showNavigator: !s.showNavigator })),

      // ✅ BUBBLES
      toggleBubbles: () => set((s) => ({ showBubbles: !s.showBubbles })),

      // --------------------
      // Zoom
      // --------------------
      setZoom: (x, y) =>
        set({
          xRange: isTupleRange(x) ? x : null,
          yRange: isTupleRange(y) ? y : null,
        }),
      resetZoom: () => set({ xRange: null, yRange: null }),

      // --------------------
      // Elipses legacy
      // --------------------
      setShowElipsesFw: (v) => set({ showElipsesFw: !!v }),
      setShowElipsesWiPrev: (v) => set({ showElipsesWiPrev: !!v }),
      toggleElipsesFw: () => set((s) => ({ showElipsesFw: !s.showElipsesFw })),
      toggleElipsesWiPrev: () =>
        set((s) => ({ showElipsesWiPrev: !s.showElipsesWiPrev })),
    }),
    {
      name: "elipsis:map-view-options",
      version: 2,

      // ✅ evita romper en contexts sin window al importar
      storage: createJSONStorage(() => localStorage),

      // ✅ opcional pero recomendado: persistimos solo lo que tiene sentido
      partialize: (s) => ({
        showMapa: s.showMapa,
        showPozos: s.showPozos,
        showElipses: s.showElipses,
        showNavigator: s.showNavigator,
        showBubbles: s.showBubbles,
        xRange: s.xRange,
        yRange: s.yRange,
        showElipsesFw: s.showElipsesFw,
        showElipsesWiPrev: s.showElipsesWiPrev,
      }),

      // ✅ merge robusto: defaults + persisted, limpiando tipos raros
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MapViewOptionsState>;

        return {
          ...current,
          ...p,
          showMapa: p.showMapa ?? current.showMapa,
          showPozos: p.showPozos ?? current.showPozos,
          showElipses: p.showElipses ?? current.showElipses,
          showNavigator: p.showNavigator ?? current.showNavigator,
          showBubbles: (p as any).showBubbles ?? (current as any).showBubbles,

          xRange: isTupleRange((p as any).xRange) ? (p as any).xRange : null,
          yRange: isTupleRange((p as any).yRange) ? (p as any).yRange : null,

          showElipsesFw: p.showElipsesFw ?? current.showElipsesFw,
          showElipsesWiPrev: p.showElipsesWiPrev ?? current.showElipsesWiPrev,
        };
      },
    },
  ),
);
