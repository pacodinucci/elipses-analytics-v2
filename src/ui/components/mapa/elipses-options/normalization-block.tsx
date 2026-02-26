import { useMemo } from "react";
import type { ElipsesNormalizationScope } from "../../../store/elipses-style";
import { useElipsesNormalization } from "../../../hooks/use-elipses-normalization";
import { Hint, SectionTitle } from "./shared";

// ✅ fix TS: Object.entries() te da `unknown` si `ranges` no está tipado fuerte en el hook.
// Acá lo tipamos localmente (cambio mínimo y efectivo).
type NormalizationRange = { min: number | null; max: number | null };

type NormalizationViewProps = {
  scope: ElipsesNormalizationScope;
  onChangeScope: (v: ElipsesNormalizationScope) => void;
  yacimientoId: string | null;
  capaNombre: string | null;
  fecha: string | null;
  normAll: ReturnType<typeof useElipsesNormalization>;
};

export function NormalizationBlockView({
  scope,
  onChangeScope,
  yacimientoId,
  capaNombre,
  fecha,
  normAll,
}: NormalizationViewProps) {
  // ✅ cast mínimo para destrabar r.min / r.max
  const ranges = normAll.ranges as Record<string, NormalizationRange>;

  return (
    <div className="elipsesOpt__card elipsesOpt__stack elipsesOpt__stack--tight">
      <SectionTitle>Normalización</SectionTitle>
      <Hint>
        Define el universo con el que se calculan min/max para esta dimensión.
      </Hint>

      <div className="elipsesOpt__grid2">
        <div className="elipsesOpt__text11">Scope</div>
        <select
          className="elipsesOpt__select"
          value={scope}
          onChange={(e) =>
            onChangeScope(e.target.value as ElipsesNormalizationScope)
          }
        >
          <option value="field_all">Yacimiento (todas las fechas)</option>
          <option value="field_date">Yacimiento (una fecha)</option>
          <option value="layer_all">Capa (todas las fechas)</option>
          <option value="layer_date">Capa (una fecha)</option>
        </select>
      </div>

      <div className="elipsesOpt__ctx">
        Contexto:{" "}
        <span className="elipsesOpt__ctxStrong">
          yacimientoId={yacimientoId ?? "null"} / capa={capaNombre ?? "null"} /
          fecha={fecha ?? "null"}
        </span>
      </div>

      <div className="elipsesOpt__rowBetween">
        <div className="elipsesOpt__h11">Rangos min/max (DB)</div>
        {normAll.loading && (
          <span className="elipsesOpt__muted11">Cargando…</span>
        )}
      </div>

      {normAll.error && (
        <div className="elipsesOpt__errorBox">{normAll.error}</div>
      )}

      {!normAll.loading &&
        !normAll.error &&
        Object.keys(ranges).length === 0 && (
          <div className="elipsesOpt__muted11">
            No hay rangos disponibles para este scope/contexto (o faltan
            capa/fecha para el scope seleccionado).
          </div>
        )}

      {Object.keys(ranges).length > 0 && (
        <div className="elipsesOpt__tableWrap">
          <table className="elipsesOpt__table">
            <thead>
              <tr>
                <th className="elipsesOpt__th elipsesOpt__th--left">
                  Variable
                </th>
                <th className="elipsesOpt__th elipsesOpt__th--right">Min</th>
                <th className="elipsesOpt__th elipsesOpt__th--right">Max</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ranges)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([name, r]) => (
                  <tr key={name}>
                    <td className="elipsesOpt__td elipsesOpt__td--left">
                      {name}
                    </td>
                    <td className="elipsesOpt__td elipsesOpt__td--right">
                      {r.min ?? "—"}
                    </td>
                    <td className="elipsesOpt__td elipsesOpt__td--right">
                      {r.max ?? "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="elipsesOpt__endpoint">
        Endpoint:{" "}
        <code className="elipsesOpt__code">GET /elipses/normalization_all</code>
      </div>
    </div>
  );
}

export function NormalizationBlock({
  scope,
  onChangeScope,
  yacimientoId,
  capaNombre,
  fecha,
  isActive,
}: {
  scope: ElipsesNormalizationScope;
  onChangeScope: (v: ElipsesNormalizationScope) => void;
  yacimientoId: string | null;
  capaNombre: string | null;
  fecha: string | null;
  isActive: boolean;
}) {
  const args = useMemo(
    () => ({
      yacimientoId: isActive ? yacimientoId : null,
      capaNombre: isActive ? capaNombre : null,
      fecha: isActive ? fecha : null,
      scope,
    }),
    [isActive, yacimientoId, capaNombre, fecha, scope],
  );

  const normAll = useElipsesNormalization(args);

  return (
    <NormalizationBlockView
      scope={scope}
      onChangeScope={onChangeScope}
      yacimientoId={yacimientoId}
      capaNombre={capaNombre}
      fecha={fecha}
      normAll={normAll}
    />
  );
}
