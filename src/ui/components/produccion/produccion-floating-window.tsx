// src/components/produccion/produccion-floating-window.tsx
import * as React from "react";
import { FloatingWindow } from "../layout/floating-window";
import { useMapaDisplayStore } from "../../store/mapa-display-store";
import "./produccion-floating-window.css";

type PozosConProduccionRow = {
  id: string;
  nombre: string;
  x: number | null;
  y: number | null;

  petroleo: number | null;
  agua: number | null;
  gas: number | null;

  // ✅ en v2 viene de ValorEscenario.inyeccionAgua
  agua_iny: number | null;
};

type Props = {
  // ✅ v2: contexto real
  proyectoId: string | null;
  capa: string | null;

  // window chrome
  initialPosition: { x: number; y: number };
  initialSize: { width: number; height: number };
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
};

function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

function isLikelyProductionTypeName(tipoNombre: string) {
  const t = normalizeName(tipoNombre);
  return t.includes("prod") || t.includes("hist");
}

function normalizeFechaKey(fecha: string | null): string | null {
  if (!fecha) return null;
  const s = String(fecha).trim();
  if (!s) return null;
  // si viniera "YYYY-MM", lo alineamos a "YYYY-MM-01"
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return s; // asumimos "YYYY-MM-DD"
}

function pickBestScenarioForTable(
  escenarios: Escenario[],
  tipos: TipoEscenario[],
): { escenario: Escenario | null; reason: string } {
  if (!escenarios.length) return { escenario: null, reason: "NO_SCENARIOS" };

  const tipoById = new Map(tipos.map((t) => [t.id, t] as const));

  // 1) Preferir tipo “producción/hist”
  for (const e of escenarios) {
    const tipo = tipoById.get(e.tipoEscenarioId);
    if (tipo && isLikelyProductionTypeName(tipo.nombre)) {
      return { escenario: e, reason: `TYPE_MATCH:${tipo.nombre}` };
    }
  }

  // 2) Si no, preferir escenarios cuyo nombre sugiera producción/histórico
  for (const e of escenarios) {
    const n = normalizeName(e.nombre);
    if (n.includes("prod") || n.includes("hist")) {
      return { escenario: e, reason: `NAME_MATCH:${e.nombre}` };
    }
  }

  // 3) Fallback: el más reciente (ya vienen ordenados DESC en tu repo)
  return { escenario: escenarios[0], reason: "FALLBACK_MOST_RECENT" };
}

export function ProduccionFloatingWindow({
  proyectoId,
  capa,
  initialPosition,
  initialSize,
  isActive,
  onFocus,
  onClose,
}: Props) {
  // ============================
  // ✅ FECHA RESUELTA IGUAL QUE DATOS MAPA
  // ============================
  const activeKey = useMapaDisplayStore((s) => s.activeKey);
  const snap = useMapaDisplayStore((s) =>
    activeKey ? s.byKey[activeKey] : null,
  );
  const fechaRaw = snap?.fecha ?? null;
  const fecha = normalizeFechaKey(fechaRaw); // ✅ normalizada

  // ============================
  // State
  // ============================
  const [rows, setRows] = React.useState<PozosConProduccionRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [escenarioMeta, setEscenarioMeta] = React.useState<{
    escenarioId: string | null;
    escenarioNombre: string | null;
    tipoNombre: string | null;
    reason: string | null;
  }>({
    escenarioId: null,
    escenarioNombre: null,
    tipoNombre: null,
    reason: null,
  });

  const canQuery = !!proyectoId && !!capa && !!fecha;

  const load = React.useCallback(async () => {
    if (!canQuery) {
      setRows([]);
      setError(null);
      setLoading(false);
      setEscenarioMeta({
        escenarioId: null,
        escenarioNombre: null,
        tipoNombre: null,
        reason: null,
      });
      return;
    }

    // IPC availability checks (v2)
    const missing: string[] = [];
    if (!window.electron?.coreCapaListByProject)
      missing.push("coreCapaListByProject");
    if (!window.electron?.corePozoListByProject)
      missing.push("corePozoListByProject");
    if (!window.electron?.scenarioListByProject)
      missing.push("scenarioListByProject");
    if (!window.electron?.scenarioTypeList) missing.push("scenarioTypeList");
    if (!window.electron?.scenarioValueListByEscenario)
      missing.push("scenarioValueListByEscenario");

    if (missing.length) {
      setError(`IPC no disponible: window.electron.${missing.join(", ")}()`);
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) cargar capas/pozos/escenarios/tipos en paralelo
      const [capas, pozos, escenarios, tipos] = await Promise.all([
        window.electron.coreCapaListByProject({ proyectoId: proyectoId! }),
        window.electron.corePozoListByProject({ proyectoId: proyectoId! }),
        window.electron.scenarioListByProject({ proyectoId: proyectoId! }),
        window.electron.scenarioTypeList(),
      ]);

      // 2) resolver capaId por nombre
      const capaNeedle = normalizeName(capa!);
      const capaFound =
        (capas ?? []).find(
          (c) => normalizeName(String((c as any).nombre ?? "")) === capaNeedle,
        ) ?? null;

      if (!capaFound?.id) {
        setRows([]);
        setEscenarioMeta({
          escenarioId: null,
          escenarioNombre: null,
          tipoNombre: null,
          reason: null,
        });
        setError(`No se encontró la capa "${capa}" en el proyecto.`);
        return;
      }

      const capaId = String(capaFound.id);

      // 3) elegir escenario “producción/hist” (best-effort)
      const pick = pickBestScenarioForTable(escenarios ?? [], tipos ?? []);
      if (!pick.escenario) {
        setRows([]);
        setEscenarioMeta({
          escenarioId: null,
          escenarioNombre: null,
          tipoNombre: null,
          reason: pick.reason,
        });
        setError(
          "No hay escenarios en este proyecto. Creá un escenario de producción/histórico.",
        );
        return;
      }

      const escenario = pick.escenario;
      const tipoById = new Map((tipos ?? []).map((t) => [t.id, t] as const));
      const tipo = tipoById.get(escenario.tipoEscenarioId) ?? null;

      setEscenarioMeta({
        escenarioId: escenario.id,
        escenarioNombre: escenario.nombre,
        tipoNombre: tipo?.nombre ?? null,
        reason: pick.reason,
      });

      // 4) traer valores del escenario y filtrar por capaId+fecha
      const valores = await window.electron.scenarioValueListByEscenario({
        escenarioId: escenario.id,
      });

      const valoresFiltrados = (valores ?? []).filter((v) => {
        return (
          String((v as any).capaId) === capaId &&
          String((v as any).fecha) === fecha!
        );
      });

      // 5) indexar pozos por id para obtener nombre/x/y
      const pozoById = new Map(
        (pozos ?? []).map((p) => [
          String((p as any).id),
          {
            id: String((p as any).id),
            nombre: String((p as any).nombre ?? "—"),
            x:
              typeof (p as any).x === "number" && Number.isFinite((p as any).x)
                ? (p as any).x
                : null,
            y:
              typeof (p as any).y === "number" && Number.isFinite((p as any).y)
                ? (p as any).y
                : null,
          },
        ]),
      );

      // 6) construir rows (por unique compuesto debería haber 0..1 por pozo)
      const out: PozosConProduccionRow[] = valoresFiltrados.map((v) => {
        const pozoId = String((v as any).pozoId);
        const pozo = pozoById.get(pozoId) ?? {
          id: pozoId,
          nombre: "—",
          x: null,
          y: null,
        };

        return {
          id: pozo.id,
          nombre: pozo.nombre,
          x: pozo.x,
          y: pozo.y,
          petroleo: (v as any).petroleo ?? null,
          agua: (v as any).agua ?? null,
          gas: (v as any).gas ?? null,
          agua_iny: (v as any).inyeccionAgua ?? null, // ✅ mapping
        };
      });

      out.sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
      );

      setRows(out);
    } catch (e: any) {
      setRows([]);
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [canQuery, proyectoId, capa, fecha]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <FloatingWindow
      title="Producción"
      initialPosition={initialPosition}
      initialSize={initialSize}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="prodWin">
        <div className="prodWin__toolbar">
          <div className="prodWin__kv">
            <div className="prodWin__k">Proyecto</div>
            <div className="prodWin__v">{proyectoId ?? "—"}</div>
          </div>

          <div className="prodWin__kv">
            <div className="prodWin__k">Capa</div>
            <div className="prodWin__v">{capa ?? "—"}</div>
          </div>

          <div className="prodWin__kv">
            <div className="prodWin__k">Fecha</div>
            <div className="prodWin__v">
              {fecha ? <code>{fecha}</code> : "—"}
            </div>
          </div>

          <div className="prodWin__kv">
            <div className="prodWin__k">Escenario</div>
            <div className="prodWin__v">
              {escenarioMeta.escenarioNombre ? (
                <>
                  <span>{escenarioMeta.escenarioNombre}</span>{" "}
                  {escenarioMeta.tipoNombre ? (
                    <span style={{ opacity: 0.7 }}>
                      (<code>{escenarioMeta.tipoNombre}</code>)
                    </span>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>

          <div className="prodWin__spacer" />

          <button
            className="prodWin__btn"
            type="button"
            onClick={load}
            disabled={!canQuery || loading}
            title={
              !canQuery
                ? "Seleccioná proyecto, capa y fecha en el mapa"
                : "Refrescar"
            }
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        {!proyectoId ? (
          <div className="prodWin__hint">Seleccioná un proyecto.</div>
        ) : !capa ? (
          <div className="prodWin__hint">Seleccioná una capa.</div>
        ) : !fecha ? (
          <div className="prodWin__hint">
            Seleccioná una fecha en el timeline del mapa.
          </div>
        ) : error ? (
          <div className="prodWin__error">{error}</div>
        ) : (
          <>
            <div className="prodWin__meta">
              <b>Rows:</b> {rows.length.toLocaleString()} • <b>Fecha:</b>{" "}
              <code>{fecha}</code>
              {escenarioMeta.reason ? (
                <>
                  {" "}
                  • <b>Pick:</b> <code>{escenarioMeta.reason}</code>
                </>
              ) : null}
            </div>

            <div className="prodWin__tableWrap">
              <table className="prodWin__table">
                <thead>
                  <tr>
                    <th>Pozo</th>
                    <th>Petroleo</th>
                    <th>Agua</th>
                    <th>Gas</th>
                    <th>Agua Iny</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="prodWin__empty">
                        Sin datos para este filtro.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id}>
                        <td className="prodWin__pozo">
                          <div className="prodWin__pozoName">{r.nombre}</div>
                          <div className="prodWin__pozoSub">
                            id: <code>{r.id}</code>
                          </div>
                        </td>
                        <td>{fmtNum(r.petroleo)}</td>
                        <td>{fmtNum(r.agua)}</td>
                        <td>{fmtNum(r.gas)}</td>
                        <td>{fmtNum(r.agua_iny)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
