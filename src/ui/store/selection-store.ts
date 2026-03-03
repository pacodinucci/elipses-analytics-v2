// src/ui/selection-store.ts
import { create } from "zustand";

type SelectionState = {
  selectedProyectoId: string | null;

  setSelectedProyectoId: (id: string | null) => void;
  clearSelection: () => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedProyectoId: null,

  setSelectedProyectoId: (id) => set({ selectedProyectoId: id }),

  clearSelection: () => set({ selectedProyectoId: null }),
}));
