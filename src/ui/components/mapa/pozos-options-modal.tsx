// src/components/mapa/pozos-options-modal.tsx
import { useEffect, useMemo, useState } from "react";
import { OptionsShellModal, type OptionsNavItem } from "./options-shell-modal";
import type {
  PozoStyle,
  PozoSymbol,
  PozoEstado,
  PozosStyleConfig,
} from "../../store/pozos-style";

import "./pozos-options-modal.css";

type PozosOptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;

  config: PozosStyleConfig;
  onChangeConfig: (
    updater: PozosStyleConfig | ((prev: PozosStyleConfig) => PozosStyleConfig),
  ) => void;

  onReset: () => void;
};

type TabKey = "visual" | "labels";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="pozosOpt__h11">{children}</div>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="pozosOpt__p10">{children}</div>;
}

const IconVisual = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 5c5.5 0 10 7 10 7s-4.5 7-10 7S2 12 2 12s4.5-7 10-7Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const IconLabels = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path
      d="M4 6h16M4 12h10M4 18h16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const ESTADOS: Array<{ value: PozoEstado; label: string }> = [
  { value: 1 as PozoEstado, label: "Productor (1)" },
  { value: 2 as PozoEstado, label: "Inyector (2)" },
  { value: 0 as PozoEstado, label: "Cerrado (0)" },
  { value: -1 as PozoEstado, label: "No existe (-1)" },
];

export function PozosOptionsModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  onReset,
}: PozosOptionsModalProps) {
  const [tab, setTab] = useState<TabKey>("visual");
  const [editingState, setEditingState] = useState<PozoEstado>(1 as PozoEstado);

  // ✅ opcional pero recomendable: reset UX al abrir
  useEffect(() => {
    if (!isOpen) return;
    setTab("visual");
    setEditingState(1 as PozoEstado);
  }, [isOpen]);

  const items: OptionsNavItem<TabKey>[] = useMemo(
    () => [
      {
        key: "visual",
        title: "Visual",
        subtitle: "Marcador, tamaño y opacidad",
        icon: <IconVisual />,
      },
      {
        key: "labels",
        title: "Etiquetas",
        subtitle: "Nombre, tamaño y desplazamiento",
        icon: <IconLabels />,
      },
    ],
    [],
  );

  const panelTitle = useMemo(() => {
    switch (tab) {
      case "visual":
        return "Visual";
      case "labels":
        return "Etiquetas";
      default:
        return "";
    }
  }, [tab]);

  // ✅ early return bien arriba
  if (!isOpen) return null;

  // -----------------------------
  // Derivados
  // -----------------------------
  const base = config.base;
  const override = config.byState?.[editingState] ?? {};
  const effective: PozoStyle =
    config.mode === "uniform" ? base : ({ ...base, ...override } as PozoStyle);

  // -----------------------------
  // Mutators
  // -----------------------------
  const updateBase = (patch: Partial<PozoStyle>) => {
    onChangeConfig((prev) => ({
      ...prev,
      base: { ...prev.base, ...patch },
    }));
  };

  const clearOverrideKey = <K extends keyof PozoStyle>(
    estado: PozoEstado,
    key: K,
  ) => {
    onChangeConfig((prev) => {
      const prevOv = (prev.byState?.[estado] ?? {}) as Partial<PozoStyle>;
      if (!(key in prevOv)) return prev;

      const nextOv: Partial<PozoStyle> = { ...prevOv };
      delete (nextOv as Record<string, unknown>)[key as string];

      return {
        ...prev,
        byState: {
          ...prev.byState,
          [estado]: nextOv,
        },
      };
    });
  };

  const setOverrideKey = <K extends keyof PozoStyle>(
    estado: PozoEstado,
    key: K,
    value: PozoStyle[K],
  ) => {
    onChangeConfig((prev) => ({
      ...prev,
      byState: {
        ...prev.byState,
        [estado]: {
          ...(prev.byState?.[estado] ?? {}),
          [key]: value,
        },
      },
    }));
  };

  const setStyleKey = <K extends keyof PozoStyle>(
    key: K,
    value: PozoStyle[K],
  ) => {
    if (config.mode === "uniform") {
      updateBase({ [key]: value } as Pick<PozoStyle, K>);
    } else {
      setOverrideKey(editingState, key, value);
    }
  };

  const setNumberKey = <K extends keyof PozoStyle>(
    key: K,
    raw: string,
    min: number,
    max: number,
  ) => {
    const v = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(v)) return;
    setStyleKey(key, clamp(v, min, max) as PozoStyle[K]);
  };

  const isOverridden = <K extends keyof PozoStyle>(key: K) => {
    if (config.mode !== "byState") return false;
    return Object.prototype.hasOwnProperty.call(override, key);
  };

  // -----------------------------
  // UI helpers
  // -----------------------------
  const ModeToggle = (
    <div className="pozosOpt__card">
      <div className="pozosOpt__row">
        <div>
          <SectionTitle>Modo</SectionTitle>
          <Hint>
            <b>Uniforme</b>: un estilo para todos los pozos. <b>Por estado</b>:
            overrides por productor/inyector/etc.
          </Hint>
        </div>

        <select
          className="pozosOpt__select"
          value={config.mode}
          onChange={(e) =>
            onChangeConfig((prev) => ({
              ...prev,
              mode: e.target.value as PozosStyleConfig["mode"],
            }))
          }
        >
          <option value="uniform">Uniforme</option>
          <option value="byState">Por estado</option>
        </select>
      </div>

      {config.mode === "byState" && (
        <div className="pozosOpt__grid2">
          <div>
            <SectionTitle>Estado a editar</SectionTitle>
            <Hint>Elegí el estado para modificar su override.</Hint>
          </div>
          <select
            className="pozosOpt__select pozosOpt__select--full"
            value={String(editingState)}
            onChange={(e) =>
              setEditingState(Number(e.target.value) as PozoEstado)
            }
          >
            {ESTADOS.map((s) => (
              <option key={String(s.value)} value={String(s.value)}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  return (
    <OptionsShellModal<TabKey>
      isOpen={isOpen}
      onClose={onClose}
      title="Opciones de pozos"
      items={items}
      activeKey={tab}
      onChangeKey={setTab}
      panelTitle={panelTitle}
      widthClassName="pozosOpt__w"
      heightClassName="pozosOpt__h"
      sidebarWidthClassName="pozosOpt__grid"
      footer={
        <div className="pozosOpt__footer">
          <button
            type="button"
            onClick={onReset}
            className="btn btn--secondary"
          >
            Restablecer
          </button>
          <button type="button" onClick={onClose} className="btn btn--primary">
            Cerrar
          </button>
        </div>
      }
    >
      {/* TAB: VISUAL */}
      {tab === "visual" && (
        <div className="pozosOpt__stack">
          {ModeToggle}

          <div className="pozosOpt__card">
            <div className="pozosOpt__row">
              <div>
                <SectionTitle>Mostrar pozos</SectionTitle>
                <Hint>Activa o desactiva la capa de pozos.</Hint>
              </div>
              <input
                type="checkbox"
                className="pozosOpt__checkbox"
                checked={!!base.enabled}
                onChange={(e) => updateBase({ enabled: e.target.checked })}
              />
            </div>
          </div>

          <div className="pozosOpt__card pozosOpt__stack pozosOpt__stack--tight">
            {/* Tamaño */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Tamaño{" "}
                  {config.mode === "byState" && isOverridden("size")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>En píxeles.</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="number"
                  min={2}
                  max={40}
                  step={1}
                  value={effective.size}
                  onChange={(e) => setNumberKey("size", e.target.value, 2, 40)}
                  className="pozosOpt__input pozosOpt__input--full"
                />
                {config.mode === "byState" && isOverridden("size") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() => clearOverrideKey(editingState, "size")}
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Opacidad */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Opacidad{" "}
                  {config.mode === "byState" && isOverridden("opacity")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>0..1</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={effective.opacity}
                  onChange={(e) =>
                    setNumberKey("opacity", e.target.value, 0, 1)
                  }
                  className="pozosOpt__input pozosOpt__input--full"
                />
                {config.mode === "byState" && isOverridden("opacity") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() => clearOverrideKey(editingState, "opacity")}
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Color */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Color{" "}
                  {config.mode === "byState" && isOverridden("color")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>Color del marcador.</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="color"
                  value={effective.color}
                  onChange={(e) => setStyleKey("color", e.target.value)}
                  className="pozosOpt__color"
                />
                {config.mode === "byState" && isOverridden("color") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() => clearOverrideKey(editingState, "color")}
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Borde color */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Borde (color){" "}
                  {config.mode === "byState" && isOverridden("borderColor")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>Color del contorno del marcador.</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="color"
                  value={effective.borderColor}
                  onChange={(e) => setStyleKey("borderColor", e.target.value)}
                  className="pozosOpt__color"
                />
                {config.mode === "byState" && isOverridden("borderColor") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() =>
                      clearOverrideKey(editingState, "borderColor")
                    }
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Borde grosor */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Borde (grosor){" "}
                  {config.mode === "byState" && isOverridden("borderWidth")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>En píxeles.</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="number"
                  min={0}
                  max={6}
                  step={0.5}
                  value={effective.borderWidth}
                  onChange={(e) =>
                    setNumberKey("borderWidth", e.target.value, 0, 6)
                  }
                  className="pozosOpt__input pozosOpt__input--full"
                />
                {config.mode === "byState" && isOverridden("borderWidth") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() =>
                      clearOverrideKey(editingState, "borderWidth")
                    }
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Símbolo */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Símbolo{" "}
                  {config.mode === "byState" && isOverridden("symbol")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>Forma del marcador.</Hint>
              </div>

              <div className="pozosOpt__inline">
                <select
                  className="pozosOpt__select pozosOpt__select--full"
                  value={effective.symbol}
                  onChange={(e) =>
                    setStyleKey("symbol", e.target.value as PozoSymbol)
                  }
                >
                  <option value="circle">Círculo</option>
                  <option value="square">Cuadrado</option>
                  <option value="triangle-up">Triángulo</option>
                </select>

                {config.mode === "byState" && isOverridden("symbol") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() => clearOverrideKey(editingState, "symbol")}
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pozosOpt__card pozosOpt__stack pozosOpt__stack--tight">
            <SectionTitle>Filtros por estado</SectionTitle>
            <Hint>Oculta estados al renderizar (no afecta los datos).</Hint>

            <div className="pozosOpt__rowBetween">
              <div className="pozosOpt__text11">Ocultar cerrados (0)</div>
              <input
                type="checkbox"
                className="pozosOpt__checkbox"
                checked={!!config.hideClosed}
                onChange={(e) =>
                  onChangeConfig((prev) => ({
                    ...prev,
                    hideClosed: e.target.checked,
                  }))
                }
              />
            </div>

            <div className="pozosOpt__rowBetween">
              <div className="pozosOpt__text11">Ocultar inexistentes (-1)</div>
              <input
                type="checkbox"
                className="pozosOpt__checkbox"
                checked={!!config.hideNonexistent}
                onChange={(e) =>
                  onChangeConfig((prev) => ({
                    ...prev,
                    hideNonexistent: e.target.checked,
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB: LABELS */}
      {tab === "labels" && (
        <div className="pozosOpt__stack">
          {ModeToggle}

          <div className="pozosOpt__card">
            <div className="pozosOpt__row">
              <div>
                <SectionTitle>
                  Mostrar etiquetas{" "}
                  {config.mode === "byState" && isOverridden("labelsEnabled")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>Muestra el nombre del pozo cerca del marcador.</Hint>
              </div>
              <input
                type="checkbox"
                className="pozosOpt__checkbox"
                checked={!!effective.labelsEnabled}
                onChange={(e) => setStyleKey("labelsEnabled", e.target.checked)}
              />
            </div>
          </div>

          <div className="pozosOpt__card pozosOpt__stack pozosOpt__stack--tight">
            {/* Font size */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Tamaño de fuente{" "}
                  {config.mode === "byState" && isOverridden("labelFontSize")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>En píxeles.</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="number"
                  min={8}
                  max={24}
                  step={1}
                  value={effective.labelFontSize}
                  onChange={(e) =>
                    setNumberKey("labelFontSize", e.target.value, 8, 24)
                  }
                  className="pozosOpt__input pozosOpt__input--full"
                />
                {config.mode === "byState" && isOverridden("labelFontSize") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() =>
                      clearOverrideKey(editingState, "labelFontSize")
                    }
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Label opacity */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Opacidad de etiqueta{" "}
                  {config.mode === "byState" && isOverridden("labelOpacity")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>0..1</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={effective.labelOpacity}
                  onChange={(e) =>
                    setNumberKey("labelOpacity", e.target.value, 0, 1)
                  }
                  className="pozosOpt__input pozosOpt__input--full"
                />
                {config.mode === "byState" && isOverridden("labelOpacity") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() =>
                      clearOverrideKey(editingState, "labelOpacity")
                    }
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Label dx/dy */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Desplazamiento X / Y{" "}
                  {config.mode === "byState" &&
                  (isOverridden("labelDx") || isOverridden("labelDy"))
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>Desplazamiento respecto al marcador.</Hint>
              </div>

              <div className="pozosOpt__cols2">
                <div className="pozosOpt__inline">
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    step={1}
                    value={effective.labelDx}
                    onChange={(e) =>
                      setNumberKey("labelDx", e.target.value, -50, 50)
                    }
                    className="pozosOpt__input pozosOpt__input--full"
                  />
                  {config.mode === "byState" && isOverridden("labelDx") && (
                    <button
                      type="button"
                      className="btn btn--secondary pozosOpt__btnSmall"
                      onClick={() => clearOverrideKey(editingState, "labelDx")}
                      title="Quitar sobrescritura"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="pozosOpt__inline">
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    step={1}
                    value={effective.labelDy}
                    onChange={(e) =>
                      setNumberKey("labelDy", e.target.value, -50, 50)
                    }
                    className="pozosOpt__input pozosOpt__input--full"
                  />
                  {config.mode === "byState" && isOverridden("labelDy") && (
                    <button
                      type="button"
                      className="btn btn--secondary pozosOpt__btnSmall"
                      onClick={() => clearOverrideKey(editingState, "labelDy")}
                      title="Quitar sobrescritura"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Label max count */}
            <div className="pozosOpt__grid2">
              <div>
                <SectionTitle>
                  Límite de etiquetas{" "}
                  {config.mode === "byState" && isOverridden("labelMaxCount")
                    ? "(sobrescrito)"
                    : ""}
                </SectionTitle>
                <Hint>0 = sin límite. Útil para performance.</Hint>
              </div>

              <div className="pozosOpt__inline">
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={50}
                  value={effective.labelMaxCount}
                  onChange={(e) =>
                    setNumberKey("labelMaxCount", e.target.value, 0, 5000)
                  }
                  className="pozosOpt__input pozosOpt__input--full"
                />
                {config.mode === "byState" && isOverridden("labelMaxCount") && (
                  <button
                    type="button"
                    className="btn btn--secondary pozosOpt__btnSmall"
                    onClick={() =>
                      clearOverrideKey(editingState, "labelMaxCount")
                    }
                    title="Quitar sobrescritura"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </OptionsShellModal>
  );
}
