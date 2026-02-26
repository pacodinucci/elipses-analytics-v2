// src/viewer/ui/hooks/use-viewer-wells.ts
import * as React from "react";

export type WellPoint = {
  id: string;
  nombre: string;
  x: number;
  y: number;
  estado: -1 | 0 | 1 | 2;
};

type Args = {
  /**
   * ✅ v2: todo cuelga del proyecto
   */
  proyectoId?: string | null;

  /**
   * ✅ compat (deprecated): algunos callsites legacy todavía pasan yacimientoId.
   * En v2 lo tratamos como "id operativo" equivalente a proyectoId.
   */
  yacimientoId?: string | null;

  /**
   * Se mantienen por compat UX (refrescar al cambiar) y por futura migración real.
   */
  capa: string | null;
  selectedDate: string | null; // YYYY-MM-DD
};

type Result = {
  wells: WellPoint[];
  loading: boolean;
  error: string | null;
};

function normalizeWellRow(row: any): WellPoint | null {
  if (!row) return null;

  const id = String(row.id ?? "").trim();
  if (!id) return null;

  const nombre = String(row.nombre ?? row.name ?? "—");

  const x = Number(row.x);
  const y = Number(row.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  // ✅ v2 (por ahora): estado no está resuelto por fecha en este hook
  // -1 = desconocido (la UI lo va a mostrar como "No existe" hoy; si querés, después lo mapeamos mejor)
  const estado: -1 | 0 | 1 | 2 = -1;

  return { id, nombre, x, y, estado };
}

export function useViewerWells({
  proyectoId = null,
  yacimientoId = null,
  capa,
  selectedDate,
}: Args): Result {
  const [wells, setWells] = React.useState<WellPoint[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // ✅ id operativo del contexto (proyecto en v2)
  const ctxProyectoId = proyectoId ?? yacimientoId ?? null;

  React.useEffect(() => {
    let alive = true;

    if (!ctxProyectoId) {
      setWells([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!window.electron?.corePozoListByProject) {
      setWells([]);
      setLoading(false);
      setError("IPC no disponible: window.electron.corePozoListByProject()");
      return;
    }

    setError(null);
    setLoading(true);

    (async () => {
      try {
        const rows = await window.electron.corePozoListByProject({
          proyectoId: ctxProyectoId,
        });

        const cleaned = (rows ?? [])
          .map(normalizeWellRow)
          .filter((p): p is WellPoint => p !== null);

        if (!alive) return;

        setWells(cleaned);
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Error desconocido cargando pozos";
        // eslint-disable-next-line no-console
        console.error("[useViewerWells] corePozoListByProject", e);

        if (!alive) return;

        setWells([]);
        setError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // ✅ mantenemos capa/selectedDate en deps para que refresque cuando el usuario cambia el contexto,
    // aunque hoy todavía no se filtren los pozos por esos params.
  }, [ctxProyectoId, capa, selectedDate]);

  return { wells, loading, error };
}
