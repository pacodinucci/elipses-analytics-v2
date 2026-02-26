import { useMemo, useState } from "react";
import { FloatingWindow } from "../layout/floating-window";
import { useMapaDisplayStore } from "../../store/mapa-display-store";
import { useMapaElipsesVisibilityStore } from "../../store/mapa-elipses-visibility";
import { useMapaElipsesFiltersStore } from "../../store/mapa-elipses-filters-store";
import "./datos-mapa-floating-window.css";

type Props = {
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  isActive?: boolean;
  onFocus?: () => void;
  onClose: () => void;
};

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

type Snapshot = NonNullable<
  ReturnType<typeof useMapaDisplayStore.getState>["byKey"][string]
>;
type HeatmapElipse = Snapshot["elipses"][number];

function isValidValue(v: unknown): v is number {
  // ✅ regla histórica acordada: válido si es finito y distinto de 0
  return typeof v === "number" && Number.isFinite(v) && v !== 0;
}

/**
 * Valor efectivo por fecha:
 * - si showHistorical=false: valor directo en fecha (si es válido)
 * - si showHistorical=true: último valor válido (≠0) con date <= fecha
 */
function getEffectiveValueForDate(
  e: HeatmapElipse,
  varName: string,
  date: string | null,
  showHistorical: boolean,
): number | null {
  if (!date) return null;

  const vars = e.variables as
    | Record<string, number | null | Record<string, number | null>>
    | undefined;

  if (!vars) return null;

  const v = vars[varName];
  if (v == null) return null;

  // caso constante (no por fecha)
  if (typeof v === "number") {
    return isValidValue(v) ? v : null;
  }

  // caso por fecha
  if (typeof v === "object") {
    const map = v as Record<string, number | null>;

    if (!showHistorical) {
      const direct = map[date];
      return isValidValue(direct) ? direct : null;
    }

    const direct = map[date];
    if (isValidValue(direct)) return direct;

    let bestDate: string | null = null;
    let bestValue: number | null = null;

    for (const k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (k > date) continue;

      const vv = map[k];
      if (!isValidValue(vv)) continue;

      if (bestDate == null || k > bestDate) {
        bestDate = k;
        bestValue = vv;
      }
    }

    return bestValue;
  }

  return null;
}

function elipseRowKey(e: HeatmapElipse, idx: number): string {
  const anyE = e as unknown as {
    id?: string | null;
    id_elipse?: string | null;
    capa?: string | null;
    inyector?: string | null;
    productor?: string | null;
  };

  return (
    anyE.id ??
    anyE.id_elipse ??
    `${anyE.capa ?? ""}|${anyE.inyector ?? ""}|${anyE.productor ?? ""}|${idx}`
  );
}

/**
 * ID estable para visibilidad manual.
 * Idealmente existe `id` o `id_elipse`. Si no, caemos a un key derivado.
 */
function elipseVisibilityId(e: HeatmapElipse, idx: number): string {
  const anyE = e as unknown as {
    id?: string | null;
    id_elipse?: string | null;
    capa?: string | null;
    inyector?: string | null;
    productor?: string | null;
  };

  return (
    anyE.id ??
    anyE.id_elipse ??
    `${anyE.capa ?? ""}|${anyE.inyector ?? ""}|${anyE.productor ?? ""}|${idx}`
  );
}

const EMPTY: never[] = [];
const EMPTY_STRINGS: string[] = [];
const EMPTY_OBJ: Record<string, true> = {};

type SortDir = "asc" | "desc";

type SortKeyPozos = "pozo" | "estado" | "x" | "y";
type SortKeyElipses = "inyector" | "productor" | `var:${string}`;

type SortState =
  | { tab: "pozos"; key: SortKeyPozos; dir: SortDir }
  | { tab: "elipses"; key: SortKeyElipses; dir: SortDir }
  | null;

function nextDir(prev: SortState, tab: "pozos" | "elipses", key: any): SortDir {
  if (!prev || prev.tab !== tab || prev.key !== key) return "desc";
  return prev.dir === "desc" ? "asc" : "desc";
}

function cmpNullableNumber(a: number | null, b: number | null, dir: SortDir) {
  const aNull = a == null || !Number.isFinite(a);
  const bNull = b == null || !Number.isFinite(b);
  if (aNull && bNull) return 0;
  if (aNull) return 1; // null al final
  if (bNull) return -1;

  return dir === "asc" ? a - b : b - a;
}

function cmpNullableString(a: string | null, b: string | null, dir: SortDir) {
  const aa = (a ?? "").trim();
  const bb = (b ?? "").trim();
  const aEmpty = aa.length === 0;
  const bEmpty = bb.length === 0;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // vacío al final
  if (bEmpty) return -1;

  const res = aa.localeCompare(bb, "es", { sensitivity: "base" });
  return dir === "asc" ? res : -res;
}

export function DatosMapaFloatingWindow({
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 520, height: 360 },
  isActive = false,
  onFocus,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"pozos" | "elipses">("pozos");
  const [query, setQuery] = useState("");

  const [sort, setSort] = useState<SortState>(null);

  const activeKey = useMapaDisplayStore((s) => s.activeKey);
  const snap = useMapaDisplayStore((s) =>
    activeKey ? s.byKey[activeKey] : null,
  );

  const pozos = snap?.pozos ?? EMPTY;
  const elipses = snap?.elipses ?? EMPTY;
  const fecha = snap?.fecha ?? null;

  const elipseVars = useMemo(
    () => snap?.elipseVariables ?? EMPTY_STRINGS,
    [snap],
  );

  // ✅ Estado de histórico por mapKey (mismo store que usa el viewer)
  const filtersForKey = useMapaElipsesFiltersStore((s) =>
    activeKey ? s.byKey[activeKey] : null,
  );
  const showHistorical = filtersForKey?.showHistorical ?? false;

  // ✅ hiddenByKey controla checkbox manual (no filtra lista)
  const hiddenMapForActiveKey = useMapaElipsesVisibilityStore((s) =>
    activeKey ? (s.hiddenByKey[activeKey] ?? EMPTY_OBJ) : EMPTY_OBJ,
  );

  const toggleElipse = useMapaElipsesVisibilityStore((s) => s.toggle);

  const q = useMemo(() => normalizeQuery(query), [query]);

  const filteredPozos = useMemo(() => {
    if (!q) return pozos;
    return pozos.filter((p) => {
      return (
        (p.nombre ?? "").toLowerCase().includes(q) ||
        (p.id ?? "").toLowerCase().includes(q)
      );
    });
  }, [pozos, q]);

  const filteredElipses = useMemo(() => {
    if (!q) return elipses;
    return elipses.filter((e) => {
      const anyE = e as any;
      return (
        (anyE.inyector ?? "").toLowerCase().includes(q) ||
        (anyE.productor ?? "").toLowerCase().includes(q) ||
        (anyE.id ?? anyE.id_elipse ?? "").toLowerCase().includes(q)
      );
    });
  }, [elipses, q]);

  // -------------------------
  // Sorting
  // -------------------------
  const sortedPozos = useMemo(() => {
    const list = [...filteredPozos];
    if (!sort || sort.tab !== "pozos") return list;

    const { key, dir } = sort;

    list.sort((a, b) => {
      if (key === "pozo")
        return cmpNullableString(a.nombre ?? null, b.nombre ?? null, dir);
      if (key === "estado")
        return cmpNullableNumber(a.estado ?? null, b.estado ?? null, dir);
      if (key === "x") return cmpNullableNumber(a.x ?? null, b.x ?? null, dir);
      if (key === "y") return cmpNullableNumber(a.y ?? null, b.y ?? null, dir);
      return 0;
    });

    return list;
  }, [filteredPozos, sort]);

  const sortedElipses = useMemo(() => {
    const list = [...filteredElipses];
    if (!sort || sort.tab !== "elipses") return list;

    const { key, dir } = sort;

    list.sort((a, b) => {
      const aa: any = a as any;
      const bb: any = b as any;

      if (key === "inyector") {
        return cmpNullableString(aa.inyector ?? null, bb.inyector ?? null, dir);
      }
      if (key === "productor") {
        return cmpNullableString(
          aa.productor ?? null,
          bb.productor ?? null,
          dir,
        );
      }

      if (typeof key === "string" && key.startsWith("var:")) {
        const varName = key.slice(4);
        const va = getEffectiveValueForDate(a, varName, fecha, showHistorical);
        const vb = getEffectiveValueForDate(b, varName, fecha, showHistorical);
        return cmpNullableNumber(va, vb, dir);
      }

      return 0;
    });

    return list;
  }, [filteredElipses, sort, fecha, showHistorical]);

  const onClickHeaderPozos = (key: SortKeyPozos) => {
    setSort((prev) => ({
      tab: "pozos",
      key,
      dir: nextDir(prev, "pozos", key),
    }));
  };

  const onClickHeaderElipses = (key: SortKeyElipses) => {
    setSort((prev) => ({
      tab: "elipses",
      key,
      dir: nextDir(prev, "elipses", key),
    }));
  };

  const sortIndicator = (tabKey: "pozos" | "elipses", key: any) => {
    if (!sort || sort.tab !== tabKey || sort.key !== key) return "";
    return sort.dir === "desc" ? " ↓" : " ↑";
  };

  return (
    <FloatingWindow
      title="Datos del mapa"
      initialPosition={initialPosition}
      initialSize={initialSize}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="datosMapa">
        {/* Header */}
        <div className="datosMapa__header">
          <button
            className={`datosMapa__tab ${tab === "pozos" ? "is-active" : ""}`}
            onClick={() => setTab("pozos")}
          >
            Pozos
          </button>

          <button
            className={`datosMapa__tab ${tab === "elipses" ? "is-active" : ""}`}
            onClick={() => setTab("elipses")}
          >
            Elipses
          </button>

          <div className="datosMapa__spacer" />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "pozos"
                ? "Buscar pozo (nombre/id)..."
                : "Buscar elipse (inyector/productor/id)..."
            }
            className="datosMapa__search"
          />

          <button
            className="datosMapa__clear"
            disabled={!query}
            onClick={() => setQuery("")}
            title="Limpiar"
          >
            ×
          </button>
        </div>

        {!snap ? (
          <div className="datosMapa__empty">
            No hay un mapa activo. Hace foco en una ventana de mapa.
          </div>
        ) : (
          <div className="datosMapa__tableWrap">
            {tab === "pozos" ? (
              <table className="datosMapa__table">
                <thead>
                  <tr>
                    <th
                      role="button"
                      onClick={() => onClickHeaderPozos("pozo")}
                      title="Ordenar por Pozo"
                      style={{ cursor: "pointer", userSelect: "none" }}
                    >
                      Pozo{sortIndicator("pozos", "pozo")}
                    </th>
                    <th
                      role="button"
                      onClick={() => onClickHeaderPozos("estado")}
                      title="Ordenar por Estado"
                      style={{ cursor: "pointer", userSelect: "none" }}
                    >
                      Estado{sortIndicator("pozos", "estado")}
                    </th>
                    <th
                      role="button"
                      onClick={() => onClickHeaderPozos("x")}
                      title="Ordenar por X"
                      style={{ cursor: "pointer", userSelect: "none" }}
                    >
                      X{sortIndicator("pozos", "x")}
                    </th>
                    <th
                      role="button"
                      onClick={() => onClickHeaderPozos("y")}
                      title="Ordenar por Y"
                      style={{ cursor: "pointer", userSelect: "none" }}
                    >
                      Y{sortIndicator("pozos", "y")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPozos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="datosMapa__noData">
                        No hay pozos que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    sortedPozos.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>
                          {p.estado === 2
                            ? "Inyector"
                            : p.estado === 1
                              ? "Productor"
                              : p.estado === 0
                                ? "Cerrado"
                                : "No existe"}
                        </td>
                        <td>{p.x.toFixed(2)}</td>
                        <td>{p.y.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="datosMapa__table">
                <thead>
                  <tr>
                    {/* columna checkbox (no sortable) */}
                    <th className="datosMapa__colCheck" title="Visible">
                      ✓
                    </th>

                    <th
                      role="button"
                      onClick={() => onClickHeaderElipses("inyector")}
                      style={{ cursor: "pointer", userSelect: "none" }}
                      title="Ordenar por Inyector"
                    >
                      Inyector{sortIndicator("elipses", "inyector")}
                    </th>

                    <th
                      role="button"
                      onClick={() => onClickHeaderElipses("productor")}
                      style={{ cursor: "pointer", userSelect: "none" }}
                      title="Ordenar por Productor"
                    >
                      Productor{sortIndicator("elipses", "productor")}
                    </th>

                    {elipseVars.map((v) => {
                      const key: SortKeyElipses = `var:${v}`;
                      return (
                        <th
                          key={v}
                          role="button"
                          onClick={() => onClickHeaderElipses(key)}
                          style={{ cursor: "pointer", userSelect: "none" }}
                          title={`Ordenar por ${v}`}
                        >
                          {v}
                          {sortIndicator("elipses", key)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedElipses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3 + elipseVars.length}
                        className="datosMapa__noData"
                      >
                        No hay elipses que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    sortedElipses.map((e, idx) => {
                      const id = elipseVisibilityId(e, idx);
                      const hidden = !!activeKey && !!hiddenMapForActiveKey[id];

                      return (
                        <tr
                          key={elipseRowKey(e, idx)}
                          className={hidden ? "is-hidden" : ""}
                        >
                          <td className="datosMapa__colCheck">
                            <input
                              type="checkbox"
                              checked={!hidden}
                              disabled={!activeKey}
                              onChange={() => {
                                if (!activeKey) return;
                                toggleElipse(activeKey, id);
                              }}
                              title={
                                hidden ? "Mostrar elipse" : "Ocultar elipse"
                              }
                            />
                          </td>

                          <td>{(e as any).inyector ?? "—"}</td>
                          <td>{(e as any).productor ?? "—"}</td>

                          {elipseVars.map((v) => {
                            const val = getEffectiveValueForDate(
                              e,
                              v,
                              fecha,
                              showHistorical,
                            );
                            return (
                              <td key={v}>
                                {val == null ? "—" : val.toFixed(4)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
