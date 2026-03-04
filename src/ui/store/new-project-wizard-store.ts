import { create } from "zustand";

export type NewProjectStep = "proyecto" | "capas" | "pozos";

type ProyectoDraft = {
  nombre: string;
  limitesTemporalDesde: string; // YYYY-MM-DD
  limitesTemporalHasta: string; // YYYY-MM-DD
  grillaN: string; // N (NxN)
};

type NewProjectWizardState = {
  step: NewProjectStep;

  // formulario step 1
  draft: ProyectoDraft;

  // resultado step 1
  proyecto: Proyecto | null;

  // archivos (step 2 y 3)
  capasFile: File | null;
  pozosFile: File | null;

  // ui state
  loading: boolean;
  error: string;

  // actions
  setStep: (step: NewProjectStep) => void;
  setDraft: (patch: Partial<ProyectoDraft>) => void;
  setProyecto: (proyecto: Proyecto | null) => void;
  setCapasFile: (file: File | null) => void;
  setPozosFile: (file: File | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;

  reset: () => void;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const initialDraft = (): ProyectoDraft => {
  const from = todayISO();
  const to = `${new Date().getFullYear() + 5}-12-31`;
  return {
    nombre: "",
    limitesTemporalDesde: from,
    limitesTemporalHasta: to,
    grillaN: "200",
  };
};

export const useNewProjectWizardStore = create<NewProjectWizardState>(
  (set) => ({
    step: "proyecto",
    draft: initialDraft(),
    proyecto: null,
    capasFile: null,
    pozosFile: null,
    loading: false,
    error: "",

    setStep: (step) => set({ step }),
    setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
    setProyecto: (proyecto) => set({ proyecto }),
    setCapasFile: (capasFile) => set({ capasFile }),
    setPozosFile: (pozosFile) => set({ pozosFile }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    reset: () =>
      set({
        step: "proyecto",
        draft: initialDraft(),
        proyecto: null,
        capasFile: null,
        pozosFile: null,
        loading: false,
        error: "",
      }),
  }),
);
