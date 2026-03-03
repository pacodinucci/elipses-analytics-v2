// src/hooks/use-escenario-produccion-for-capa.ts
import * as React from "react";

type Result<T> = {
  rows: T[];
  loading: boolean;
  error: string | null;
  source: "capa" | "superficie" | "none";
  reload: () => void;
};

function normDateKey(fecha: any): string {
  return String(fecha ?? "").slice(0, 10); // "YYYY-MM-DD"
}

export function useEscenarioProduccionForCapa(args: {
  proyectoId: string | null;
  escenarioId: string | null;
  capaId: string | null;
  fecha: string | null; // "YYYY-MM-DD"
}): Result<ValorEscenario> {
  const { proyectoId, escenarioId, capaId, fecha } = args;

  const [rows, setRows] = React.useState<ValorEscenario[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<"capa" | "superficie" | "none">(
    "none",
  );

  const canQuery = !!proyectoId && !!escenarioId && !!fecha;

  const load = React.useCallback(async () => {
    if (!canQuery) {
      setRows([]);
      setLoading(false);
      setError(null);
      setSource("none");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) Traer escenario para saber su tipo
      const escenarios = await window.electron.scenarioListByProject({
        proyectoId: proyectoId!,
      });
      const escenario = escenarios.find((e) => e.id === escenarioId) ?? null;

      // 2) Traer tipos para resolver nombre (historia/datos/primaria/inyeccion)
      const tipos = await window.electron.scenarioTypeList();
      const tipo =
        tipos.find((t) => t.id === (escenario as any)?.tipoEscenarioId) ?? null;
      const tipoNombre = String((tipo as any)?.nombre ?? "")
        .toLowerCase()
        .trim();

      const isSurfaceScenario = tipoNombre === "historia";

      // 3) Traer valores
      const all = await window.electron.scenarioValueListByEscenario({
        escenarioId: escenarioId!,
      });

      // 4) Filtrar por fecha (siempre)
      const byFecha = (all ?? []).filter(
        (r) => normDateKey((r as any).fecha) === String(fecha),
      );

      // 5) Si es “historia”: ignorar capaId y devolver superficie
      if (isSurfaceScenario) {
        setRows(byFecha);
        setSource("superficie");
        return;
      }

      // 6) Si NO es historia: intentar por capa si tenemos capaId
      if (capaId) {
        const byCapa = byFecha.filter(
          (r) => String((r as any).capaId ?? "") === String(capaId),
        );
        if (byCapa.length > 0) {
          setRows(byCapa);
          setSource("capa");
          return;
        }
      }

      // 7) Fallback: si no hay por capa (o no hay capaId), devolvemos “superficie”
      // (esto cubre escenarios que no “llevan capa” aunque no sean historia)
      setRows(byFecha);
      setSource("superficie");
    } catch (e: any) {
      setRows([]);
      setError(e?.message ?? String(e));
      setSource("none");
    } finally {
      setLoading(false);
    }
  }, [canQuery, proyectoId, escenarioId, capaId, fecha]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, source, reload: load };
}
