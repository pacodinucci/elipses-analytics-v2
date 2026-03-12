import React from "react";
import { TbRuler, TbSearch } from "react-icons/tb";
import {
  OptionsShellModal,
  type OptionsNavItem,
} from "../mapa/options-shell-modal";
import "./unidades-modal.css";

type UnidadOption = {
  unidad: string;
  alias: string;
  formato: string;
  activa: boolean;
};

type UnidadConfig = {
  version: number;
  placeholder: boolean;
  formatoDefault: string;
  activa: string | null;
  opciones: UnidadOption[];
};

type UnidadesModalProps = {
  isOpen: boolean;
  proyectoId: string | null;
  onClose: () => void;
};

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toStringSafe(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeOptions(raw: unknown): UnidadOption[] {
  if (!Array.isArray(raw)) return [];

  const parsed = raw
    .map((row) => {
      const o = toObject(row);
      const unidad = toStringSafe(o.unidad).trim();
      if (!unidad) return null;
      return {
        unidad,
        alias: toStringSafe(o.alias),
        formato: toStringSafe(o.formato, "0.0") || "0.0",
        activa: Boolean(o.activa),
      } as UnidadOption;
    })
    .filter((row): row is UnidadOption => row !== null);

  if (parsed.length === 0) return [];

  let activeIndex = parsed.findIndex((row) => row.activa);
  if (activeIndex < 0) activeIndex = 0;

  return parsed.map((row, idx) => ({ ...row, activa: idx === activeIndex }));
}

function normalizeConfig(raw: unknown): UnidadConfig {
  const obj = toObject(raw);
  const opciones = normalizeOptions(obj.opciones);

  const active = opciones.find((o) => o.activa) ?? opciones[0] ?? null;

  return {
    version: Number(obj.version ?? 3),
    placeholder: Boolean(obj.placeholder ?? true),
    formatoDefault: toStringSafe(obj.formatoDefault, active?.formato ?? "0.0"),
    activa:
      toStringSafe(obj.activa, active?.unidad ?? "") ||
      (active?.unidad ?? null),
    opciones,
  };
}

function withSingleActive(
  options: UnidadOption[],
  activeUnidad: string,
): UnidadOption[] {
  let found = false;
  const next = options.map((opt) => {
    const active = opt.unidad === activeUnidad;
    if (active) found = true;
    return { ...opt, activa: active };
  });

  if (!found && next.length > 0) {
    next[0] = { ...next[0], activa: true };
  }

  return next;
}

function buildConfig(
  options: UnidadOption[],
  previous: UnidadConfig,
): UnidadConfig {
  const active = options.find((o) => o.activa) ?? options[0] ?? null;
  return {
    ...previous,
    formatoDefault: active?.formato ?? "0.0",
    activa: active?.unidad ?? null,
    opciones: options,
  };
}

export function UnidadesModal({
  isOpen,
  proyectoId,
  onClose,
}: UnidadesModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const [rows, setRows] = React.useState<Unidades[]>([]);
  const [draftByUnidad, setDraftByUnidad] = React.useState<
    Record<string, UnidadConfig>
  >({});
  const [selectedUnidad, setSelectedUnidad] = React.useState<string>("");
  const [saveProgress, setSaveProgress] = React.useState<{
    done: number;
    total: number;
  }>({ done: 0, total: 0 });

  const load = React.useCallback(async () => {
    if (!isOpen || !proyectoId) return;
    setLoading(true);
    setError(null);

    try {
      const list = await window.electron.unidadesListByProyecto({ proyectoId });
      const sorted = [...list].sort((a, b) =>
        String(a.unidad).localeCompare(String(b.unidad)),
      );

      const draft: Record<string, UnidadConfig> = {};
      for (const row of sorted) {
        draft[row.unidad] = normalizeConfig(row.configJson);
      }

      setRows(sorted);
      setDraftByUnidad(draft);

      setSelectedUnidad((prev) => {
        if (prev && sorted.some((x) => x.unidad === prev)) return prev;
        return sorted[0]?.unidad ?? "";
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar las unidades.",
      );
    } finally {
      setLoading(false);
    }
  }, [isOpen, proyectoId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const navItems = React.useMemo<OptionsNavItem<string>[]>(() => {
    const q = search.trim().toLowerCase();
    const source = rows.map((row) => row.unidad);
    const filtered = q
      ? source.filter((name) => name.toLowerCase().includes(q))
      : source;

    return filtered.map((unidad) => ({
      key: unidad,
      title: unidad,
      icon: <TbRuler />,
    }));
  }, [rows, search]);

  React.useEffect(() => {
    if (!navItems.some((it) => it.key === selectedUnidad)) {
      setSelectedUnidad(navItems[0]?.key ?? "");
    }
  }, [navItems, selectedUnidad]);

  const selectedDraft = selectedUnidad
    ? draftByUnidad[selectedUnidad]
    : undefined;

  const onSetActive = (unidadOption: string) => {
    if (!selectedUnidad || !selectedDraft) return;

    const opciones = withSingleActive(selectedDraft.opciones, unidadOption);
    setDraftByUnidad((prev) => ({
      ...prev,
      [selectedUnidad]: buildConfig(opciones, selectedDraft),
    }));
  };

  const onChangeFormato = (idx: number, formato: string) => {
    if (!selectedUnidad || !selectedDraft) return;

    const opciones = selectedDraft.opciones.map((opt, i) =>
      i === idx ? { ...opt, formato } : opt,
    );

    setDraftByUnidad((prev) => ({
      ...prev,
      [selectedUnidad]: buildConfig(opciones, selectedDraft),
    }));
  };

  const onChangeAlias = (idx: number, alias: string) => {
    if (!selectedUnidad || !selectedDraft) return;

    const opciones = selectedDraft.opciones.map((opt, i) =>
      i === idx ? { ...opt, alias } : opt,
    );

    setDraftByUnidad((prev) => ({
      ...prev,
      [selectedUnidad]: buildConfig(opciones, selectedDraft),
    }));
  };

  const handleSave = async () => {
    if (!proyectoId) return;

    setSaving(true);
    setError(null);

    const rowsToSave = rows.filter((row) => Boolean(draftByUnidad[row.unidad]));
    setSaveProgress({ done: 0, total: rowsToSave.length });

    try {
      for (let idx = 0; idx < rowsToSave.length; idx += 1) {
        const row = rowsToSave[idx];
        const draft = draftByUnidad[row.unidad];
        if (!draft) continue;

        await window.electron.unidadesUpsert({
          id: row.id,
          proyectoId,
          unidad: row.unidad,
          configJson: draft,
          extrasJson:
            row.extrasJson && typeof row.extrasJson === "object"
              ? (row.extrasJson as Record<string, unknown>)
              : {},
        });

        setSaveProgress({ done: idx + 1, total: rowsToSave.length });
      }

      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la configuraci�n.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <OptionsShellModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edición > Unidades"
      items={navItems}
      activeKey={selectedUnidad}
      onChangeKey={setSelectedUnidad}
      widthClassName="osm__wDefault"
      heightClassName="osm__hDefault"
      sidebarWidthClassName="osm__gridFull"
      panelTitle={selectedUnidad || "Unidades"}
      panelSubtitle="Seleccioná una fila para definir la unidad activa"
      headerRight={
        <div className="unidadesModal__searchWrap">
          <TbSearch />
          <input
            className="unidadesModal__search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar variable..."
          />
        </div>
      }
      footer={
        <div className="unidadesModal__footer">
          <div className="unidadesModal__footerStatus" aria-live="polite">
            {saving ? (
              <>
                <span>
                  Guardando {saveProgress.done}/{saveProgress.total}
                </span>
                <div className="unidadesModal__progress">
                  <div
                    className="unidadesModal__progressBar"
                    style={{
                      width:
                        saveProgress.total > 0
                          ? `${Math.round((saveProgress.done / saveProgress.total) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="osm__footerBtn"
            onClick={load}
            disabled={loading || saving}
          >
            Restaurar
          </button>
          <button
            type="button"
            className="osm__footerBtn"
            onClick={handleSave}
            disabled={loading || saving || rows.length === 0}
          >
            {saving ? "Guardando..." : "Guardar todo"}
          </button>
          <button
            type="button"
            className="osm__footerBtn"
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="unidadesModal__state">Cargando unidades...</div>
      ) : null}

      {!loading && error ? (
        <div className="unidadesModal__error">{error}</div>
      ) : null}

      {!loading && !error && !selectedDraft ? (
        <div className="unidadesModal__state">
          Seleccioná una variable para editar sus opciones.
        </div>
      ) : null}

      {!loading && !error && selectedDraft ? (
        <div className="unidadesModal__tableWrap">
          <table className="unidadesModal__table">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Alias</th>
                <th>Formato</th>
              </tr>
            </thead>
            <tbody>
              {selectedDraft.opciones.map((opt, idx) => {
                const isActive = opt.activa;
                return (
                  <tr
                    key={opt.unidad}
                    className={[
                      "unidadesModal__row",
                      isActive ? "is-active" : "",
                    ].join(" ")}
                    onClick={() => onSetActive(opt.unidad)}
                  >
                    <td>{opt.unidad}</td>
                    <td>
                      <input
                        className="unidadesModal__input"
                        value={opt.alias}
                        onChange={(e) => onChangeAlias(idx, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="unidadesModal__input"
                        value={opt.formato}
                        onChange={(e) => onChangeFormato(idx, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </OptionsShellModal>
  );
}
