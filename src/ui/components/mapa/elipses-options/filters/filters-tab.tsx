// src/components/mapa/elipses-options/filters/filters-tab.tsx
import * as React from "react";
import { FaRegTrashCan } from "react-icons/fa6";

import { Hint, SectionTitle } from "../shared";

import { useMapaDisplayStore } from "../../../../store/mapa-display-store";
import {
  useMapaElipsesFiltersStore,
  type FilterOp,
} from "../../../../store/mapa-elipses-filters-store";
import { Switch } from "../switch";

export type ElipsesFilterRow = {
  id: string;
  variable: string | null;
  op: FilterOp;
  value: string;
};

const OPS: { value: FilterOp; label: string }[] = [
  { value: ">", label: "Mayor" },
  { value: ">=", label: "Mayor o igual" },
  { value: "<", label: "Menor" },
  { value: "<=", label: "Menor o igual" },
  { value: "=", label: "Igual" },
  { value: "!=", label: "Distinto" },
];

const DEFAULT_ROWS: ElipsesFilterRow[] = [
  { id: "r1", variable: null, op: ">", value: "" },
];

type Props = {
  elipseVariables: string[];
};

export function FiltersTab({ elipseVariables }: Props) {
  const activeKey = useMapaDisplayStore((s) => s.activeKey);

  const ensure = useMapaElipsesFiltersStore((s) => s.ensure);
  const setShowHistorical = useMapaElipsesFiltersStore(
    (s) => s.setShowHistorical,
  );
  const setRows = useMapaElipsesFiltersStore((s) => s.setRows);
  const addRowStore = useMapaElipsesFiltersStore((s) => s.addRow);
  const removeRowStore = useMapaElipsesFiltersStore((s) => s.removeRow);
  const clearStore = useMapaElipsesFiltersStore((s) => s.clear);

  React.useEffect(() => {
    if (!activeKey) return;
    ensure(activeKey);
  }, [activeKey, ensure]);

  const filters = useMapaElipsesFiltersStore((s) =>
    activeKey ? s.byKey[activeKey] : null,
  );

  const disabled = !activeKey || !filters;

  const showHistorical = filters?.showHistorical ?? false;
  const rows = (filters?.rows as ElipsesFilterRow[]) ?? DEFAULT_ROWS;

  const patchRow = (rowId: string, patch: Partial<ElipsesFilterRow>) => {
    if (!activeKey) return;
    const next = rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r));
    setRows(activeKey, next);
  };

  const addRow = () => {
    if (!activeKey) return;
    addRowStore(activeKey);
  };

  const removeRow = (rowId: string) => {
    if (!activeKey) return;
    removeRowStore(activeKey, rowId);
  };

  const clearAll = () => {
    if (!activeKey) return;
    clearStore(activeKey);
  };

  return (
    <div className="elipsesOpt__stack">
      {/* ========================= HISTÓRICAS ========================= */}
      <div className="elipsesOpt__card">
        <div className="elipsesOpt__row">
          <div>
            <SectionTitle>Mostrar elipses históricas</SectionTitle>
            <Hint>
              Usa el último valor válido (≠ 0 y finito) hacia atrás hasta la
              fecha actual.
            </Hint>
          </div>

          <Switch
            checked={showHistorical}
            disabled={disabled}
            onChange={(checked) => {
              if (!activeKey) return;
              setShowHistorical(activeKey, checked);
            }}
            aria-label="Mostrar elipses históricas"
          />
        </div>
      </div>

      {/* ========================= REGLAS ========================= */}
      <div className="elipsesOpt__card elipsesOpt__stack elipsesOpt__stack--tight">
        <div>
          <SectionTitle>Reglas</SectionTitle>
          <Hint>Cada regla se evalúa por variable, condición y valor.</Hint>
        </div>

        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="elipsesOpt__row elipsesOpt__row--tight"
            aria-label={`Regla ${idx + 1}`}
          >
            <select
              className="elipsesOpt__select"
              value={row.variable ?? ""}
              disabled={disabled}
              onChange={(e) =>
                patchRow(row.id, { variable: e.target.value || null })
              }
              aria-label={`Variable filtro ${idx + 1}`}
              title="Variable"
            >
              <option value="">Seleccionar…</option>
              {elipseVariables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              className="elipsesOpt__select"
              value={row.op}
              disabled={disabled}
              onChange={(e) =>
                patchRow(row.id, { op: e.target.value as FilterOp })
              }
              aria-label={`Operador filtro ${idx + 1}`}
              title="Condición"
            >
              {OPS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            <input
              className="elipsesOpt__input"
              placeholder="Valor…"
              value={row.value}
              disabled={disabled}
              onChange={(e) => patchRow(row.id, { value: e.target.value })}
              aria-label={`Valor filtro ${idx + 1}`}
              title="Valor"
            />

            <button
              type="button"
              title="Eliminar regla"
              onClick={() => removeRow(row.id)}
              disabled={disabled || rows.length <= 1}
              aria-label={`Eliminar filtro ${idx + 1}`}
              className="elipsesOpt__iconBtn"
              style={{
                alignSelf: "center",
                height: 24,
                width: 24,
                display: "grid",
                placeItems: "center",
                padding: 2,
              }}
            >
              <FaRegTrashCan size={14} />
            </button>
          </div>
        ))}

        <div className="elipsesOpt__row elipsesOpt__row--tight">
          <button
            type="button"
            className="elipsesOpt__btn"
            onClick={addRow}
            disabled={disabled}
          >
            + Agregar regla
          </button>

          <button
            type="button"
            className="elipsesOpt__btn elipsesOpt__btn--ghost"
            onClick={clearAll}
            disabled={disabled}
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
