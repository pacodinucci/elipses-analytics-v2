import { create } from "zustand";
import type { MapKey } from "./mapa-display-store";

type ElipseId = string;

type State = {
  hiddenByKey: Record<MapKey, Record<ElipseId, true>>; // objeto en vez de Set (serializable)

  isHidden: (key: MapKey, id: ElipseId) => boolean;
  setHidden: (key: MapKey, id: ElipseId, hidden: boolean) => void;
  toggle: (key: MapKey, id: ElipseId) => void;

  clearKey: (key: MapKey) => void;
  clearAll: () => void;
};

export const useMapaElipsesVisibilityStore = create<State>((set, get) => ({
  hiddenByKey: {},

  isHidden: (key, id) => !!get().hiddenByKey[key]?.[id],

  setHidden: (key, id, hidden) =>
    set((s) => {
      const prev = s.hiddenByKey[key] ?? {};
      const next = { ...prev };
      if (hidden) next[id] = true;
      else delete next[id];

      return { hiddenByKey: { ...s.hiddenByKey, [key]: next } };
    }),

  toggle: (key, id) => {
    const hidden = get().isHidden(key, id);
    get().setHidden(key, id, !hidden);
  },

  clearKey: (key) =>
    set((s) => {
      const { [key]: _, ...rest } = s.hiddenByKey;
      return { hiddenByKey: rest };
    }),

  clearAll: () => set({ hiddenByKey: {} }),
}));
