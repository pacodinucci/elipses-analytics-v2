// src/ui/hooks/use-capas.ts
import { useEffect, useState } from "react";

type State = {
  capas: CapaRow[];
  loading: boolean;
  error: string | null;
};

// Cache simple por sesión PER-PROYECTO
const cacheByProyecto = new Map<string, CapaRow[]>();
const cacheErrorByProyecto = new Map<string, string>();
const cachePromiseByProyecto = new Map<string, Promise<CapaRow[]>>();

function normalizeCapaRow(c: any): CapaRow {
  // v2 puede traer { id, name } o { id, nombre }
  const nombre = String(c?.nombre ?? c?.name ?? "").trim();

  return {
    ...c,
    id: String(c?.id),
    nombre,
  } as CapaRow;
}

async function fetchCapasByProyecto(proyectoId: string): Promise<CapaRow[]> {
  if (cacheByProyecto.has(proyectoId)) return cacheByProyecto.get(proyectoId)!;
  if (cacheErrorByProyecto.has(proyectoId)) {
    throw new Error(cacheErrorByProyecto.get(proyectoId)!);
  }

  const inFlight = cachePromiseByProyecto.get(proyectoId);
  if (inFlight) return inFlight;

  const p = (async () => {
    // ✅ v2 IPC
    const res = await window.electron.coreCapaListByProject({ proyectoId });

    const list = Array.isArray(res) ? res : [];
    const capas = list.map(normalizeCapaRow);

    cacheByProyecto.set(proyectoId, capas);
    cachePromiseByProyecto.delete(proyectoId);
    return capas;
  })().catch((e) => {
    cachePromiseByProyecto.delete(proyectoId);
    const msg = e instanceof Error ? e.message : "Error al cargar capas";
    cacheErrorByProyecto.set(proyectoId, msg);
    throw e;
  });

  cachePromiseByProyecto.set(proyectoId, p);
  return p;
}

/**
 * v2: Carga capas por proyecto (con cache por sesión por proyectoId)
 */
export function useCapas(proyectoId: string | null): State {
  const [capas, setCapas] = useState<CapaRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!proyectoId) {
        setCapas([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const list = await fetchCapasByProyecto(proyectoId);
        if (cancelled) return;
        setCapas(list);
      } catch (e) {
        if (cancelled) return;
        setCapas([]);
        setError(e instanceof Error ? e.message : "Error al cargar capas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [proyectoId]);

  return { capas, loading, error };
}

/**
 * ✅ Helper opcional: invalidar cache (útil después de importCapasCommit)
 */
export function invalidateCapasCache(proyectoId: string) {
  cacheByProyecto.delete(proyectoId);
  cacheErrorByProyecto.delete(proyectoId);
  cachePromiseByProyecto.delete(proyectoId);
}
