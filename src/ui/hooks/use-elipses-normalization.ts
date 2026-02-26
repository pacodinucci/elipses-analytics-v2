import { useEffect, useMemo, useState } from "react";
import type {
  ElipsesNormalizationScope,
  ElipsesNormalizationRanges,
} from "../store/elipses-style";

/**
 * Cache por sesión:
 * key -> { [variable]: { min, max } }
 */
const cache = new Map<string, ElipsesNormalizationRanges>();

/**
 * ✅ v2: usar proyectoId.
 * ✅ compat: aceptar yacimientoId por callsites legacy.
 */
type Args = {
  proyectoId?: string | null;
  yacimientoId?: string | null; // compat (deprecated)
  capaNombre: string | null;
  fecha: string | null; // YYYY-MM-DD
  scope: ElipsesNormalizationScope;
};

export type ElipsesNormalizationState = {
  loading: boolean;
  ranges: ElipsesNormalizationRanges;
  error: string | null;
};

type NormalizationOk = {
  ok: true;
  ranges: ElipsesNormalizationRanges;
};

type NormalizationErr = {
  ok: false;
  error: string;
};

type NormalizationResponse = NormalizationOk | NormalizationErr;

function isScopeValid(scope: string): scope is ElipsesNormalizationScope {
  return (
    scope === "layer_date" ||
    scope === "layer_all" ||
    scope === "field_date" ||
    scope === "field_all"
  );
}

function normalizeScope(
  scope: ElipsesNormalizationScope,
): ElipsesNormalizationScope {
  return isScopeValid(scope) ? scope : "layer_date";
}

function needsCapa(scope: ElipsesNormalizationScope) {
  return scope === "layer_date" || scope === "layer_all";
}

function needsFecha(scope: ElipsesNormalizationScope) {
  return scope === "layer_date" || scope === "field_date";
}

/**
 * Helper: lectura segura de min/max auto para una variable.
 * Devuelve null si la variable no existe o si el backend devolvió null.
 */
export function getAutoRangeForVariable(
  ranges: ElipsesNormalizationRanges,
  variable: string | null,
): { min: number | null; max: number | null } {
  if (!variable) return { min: null, max: null };
  const r = ranges[variable];
  if (!r) return { min: null, max: null };
  return { min: r.min ?? null, max: r.max ?? null };
}

export function useElipsesNormalization({
  proyectoId = null,
  yacimientoId = null,
  capaNombre,
  fecha,
  scope,
}: Args): ElipsesNormalizationState {
  const [state, setState] = useState<ElipsesNormalizationState>({
    loading: false,
    ranges: {},
    error: null,
  });

  // ✅ id operativo del contexto (proyecto en v2)
  const ctxId = proyectoId ?? yacimientoId ?? null;

  const normalizedScope = useMemo(() => normalizeScope(scope), [scope]);

  /**
   * ✅ Key estable:
   * - Incluye scope + ctxId/capa/fecha.
   */
  const key = useMemo(() => {
    return [normalizedScope, ctxId ?? "", capaNombre ?? "", fecha ?? ""].join(
      "|",
    );
  }, [normalizedScope, ctxId, capaNombre, fecha]);

  useEffect(() => {
    // sin contexto no hay nada que hacer
    if (!ctxId) {
      setState({ loading: false, ranges: {}, error: null });
      return;
    }

    // si faltan params requeridos para el scope -> limpiar state
    const missing =
      (needsCapa(normalizedScope) && !capaNombre) ||
      (needsFecha(normalizedScope) && !fecha);

    if (missing) {
      setState({ loading: false, ranges: {}, error: null });
      return;
    }

    // cache hit
    const cached = cache.get(key);
    if (cached) {
      setState({ loading: false, ranges: cached, error: null });
      return;
    }

    if (!window.electron?.elipsesNormalizationAll) {
      setState({
        loading: false,
        ranges: {},
        error: "IPC no disponible: window.electron.elipsesNormalizationAll()",
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        // ✅ IPC legacy espera yacimientoId; en v2 mandamos ctxId (=proyectoId)
        const resp: NormalizationResponse =
          await window.electron.elipsesNormalizationAll({
            yacimientoId: ctxId,
            scope: normalizedScope,
            capa: capaNombre,
            fecha,
          });

        if (cancelled) return;

        if (!resp.ok) {
          throw new Error(resp.error ?? "Error de normalización");
        }

        const ranges = resp.ranges ?? {};
        cache.set(key, ranges);

        setState({ loading: false, ranges, error: null });
      } catch (e: unknown) {
        if (cancelled) return;

        const message =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Unknown error";

        setState({ loading: false, ranges: {}, error: message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, normalizedScope, ctxId, capaNombre, fecha]);

  return state;
}

/**
 * Opcional (para debug): permite limpiar el cache en runtime
 * si cambiás la lógica del backend y querés forzar refresh sin reiniciar.
 */
export function __clearElipsesNormalizationCache() {
  cache.clear();
}
