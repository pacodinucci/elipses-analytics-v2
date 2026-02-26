// src/store/proyectos-store.ts
import { create } from "zustand";

type CreateProyectoInput = {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  alias: string;
  descripcion?: string;
};

type ProyectosState = {
  proyectos: Proyecto[];
  loading: boolean;
  error: string | null;

  fetchProyectos: () => Promise<void>;
  createProyecto: (input: CreateProyectoInput) => Promise<Proyecto>;

  getById: (id: string | null | undefined) => Proyecto | null;
};

function normalizeProyecto(p: any): Proyecto {
  // v2 puede traer { name } y tu UI espera { nombre }
  const nombre = String(p?.nombre ?? p?.name ?? "").trim();

  return {
    ...p,
    id: String(p?.id),
    nombre,
  } as Proyecto;
}

export const useProyectosStore = create<ProyectosState>((set, get) => ({
  proyectos: [],
  loading: false,
  error: null,

  getById: (id) => {
    if (!id) return null;
    return get().proyectos.find((p) => p.id === id) ?? null;
  },

  fetchProyectos: async () => {
    set((s) => ({ ...s, loading: true, error: null }));
    try {
      // ✅ v2
      const res = await window.electron.coreProyectoList();
      const proyectos = Array.isArray(res) ? res.map(normalizeProyecto) : [];

      set({ proyectos, loading: false, error: null });
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Error desconocido al cargar proyectos";
      console.error("[proyectos-store.fetchProyectos]", e);
      set((s) => ({ ...s, loading: false, error: msg }));
    }
  },

  createProyecto: async (input) => {
    set((s) => ({ ...s, loading: true, error: null }));
    try {
      // ✅ v2 recomendado: bootstrap (proyecto + unidades)
      // Si tu backendInit requiere algo más, lo ajustamos después con el type real.
      const payload: CreateProyectoBootstrapInput = {
        proyecto: {
          name: input.nombre,
          descripcion: input.descripcion ?? "",
        },
      } as any;

      const result = await window.electron.coreProyectoInitialize(payload);
      const created = normalizeProyecto(result?.proyecto);

      set((s) => ({
        proyectos: [created, ...s.proyectos],
        loading: false,
        error: null,
      }));

      return created;
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Error desconocido al crear proyecto";
      console.error("[proyectos-store.createProyecto]", e);
      set((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  },
}));
