// src/components/mapa/map-options-modal.tsx
import { useMemo, useState } from "react";
import type { HeatmapStyle } from "../../store/heatmap-style";
import { OptionsShellModal, type OptionsNavItem } from "./options-shell-modal";

import "./map-options-modal.css";

type MapOptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  heatmapStyle: HeatmapStyle;
  setHeatmapStyle: (
    updater: HeatmapStyle | ((prev: HeatmapStyle) => HeatmapStyle),
  ) => void;
  gridMin: number;
  gridMax: number;
  onReset: () => void;
};

type TabKey = "colorbar" | "grid";

const IconColorbar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M9 7h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M9 12h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M9 17h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconGrid = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 4h16v16H4V4Z" stroke="currentColor" strokeWidth="2" />
    <path d="M4 12h16" stroke="currentColor" strokeWidth="2" />
    <path d="M12 4v16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export function MapOptionsModal({
  isOpen,
  onClose,
  heatmapStyle,
  setHeatmapStyle,
  gridMin,
  gridMax,
  onReset,
}: MapOptionsModalProps) {
  const [tab, setTab] = useState<TabKey>("colorbar");

  const items: OptionsNavItem<TabKey>[] = useMemo(
    () => [
      {
        key: "colorbar",
        title: "Barra de referencia",
        subtitle: "Rango, modo, marcadores",
        icon: <IconColorbar />,
      },
      {
        key: "grid",
        title: "Grilla",
        subtitle: "Mostrar y espaciado",
        icon: <IconGrid />,
      },
    ],
    [],
  );

  const isAuto = heatmapStyle.valueRangeMode === "auto";
  const canDeleteStop = !isAuto && heatmapStyle.customStops.length > 2;

  const addStop = () => {
    if (isAuto) return;

    setHeatmapStyle((s) => {
      const values = s.customStops.map((st) => st.value);
      const min = values.length > 0 ? Math.min(...values) : gridMin;
      const max = values.length > 0 ? Math.max(...values) : gridMax;
      const mid = (min + max) / 2;

      const newStop = {
        id: String(Date.now()),
        value: mid,
        color: "#ffffff",
      };

      const customStops = [...s.customStops, newStop].sort(
        (a, b) => a.value - b.value,
      );

      return { ...s, customStops };
    });
  };

  const updateStop = (
    id: string,
    patch: Partial<{ value: number; color: string }>,
  ) => {
    setHeatmapStyle((s) => ({
      ...s,
      customStops: s.customStops.map((st) =>
        st.id === id ? { ...st, ...patch } : st,
      ),
    }));
  };

  const deleteStop = (id: string) => {
    if (!canDeleteStop) return;
    setHeatmapStyle((s) => ({
      ...s,
      customStops: s.customStops.filter((st) => st.id !== id),
    }));
  };

  const panelTitle = useMemo(() => {
    switch (tab) {
      case "colorbar":
        return "Barra de referencia";
      case "grid":
        return "Grilla";
    }
  }, [tab]);

  if (!isOpen) return null;

  return (
    <OptionsShellModal<TabKey>
      isOpen={isOpen}
      onClose={onClose}
      title="Opciones de mapa"
      items={items}
      activeKey={tab}
      onChangeKey={setTab}
      panelTitle={panelTitle}
      widthClassName="mapOptions__w"
      heightClassName="mapOptions__h"
      sidebarWidthClassName="mapOptions__grid"
      footer={
        <div className="mapOptions__footer">
          <button
            type="button"
            onClick={onReset}
            className="btn btn--secondary mapOptions__btn"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn--primary mapOptions__btn"
          >
            Cerrar
          </button>
        </div>
      }
    >
      {/* ==================== TAB: BARRA DE REFERENCIA ==================== */}
      {tab === "colorbar" && (
        <div className="mapOptions__stack">
          <div className="mapOptions__card">
            <div className="mapOptions__row">
              <div>
                <div className="mapOptions__h11">
                  Mostrar barra de referencia
                </div>
                <div className="mapOptions__p10">
                  Activa/desactiva la barra lateral (colorbar) del heatmap.
                </div>
              </div>

              <input
                type="checkbox"
                className="mapOptions__checkbox"
                checked={heatmapStyle.showScale}
                onChange={(e) =>
                  setHeatmapStyle((s) => ({
                    ...s,
                    showScale: e.target.checked,
                  }))
                }
              />
            </div>
          </div>

          <div className="mapOptions__card mapOptions__stack">
            {/* Rango de valores */}
            <div className="mapOptions__section">
              <div className="mapOptions__h11">Rango de valores</div>
              <div className="mapOptions__p10">
                Define cómo se calcula el min/max usado por la barra y/o los
                marcadores.
              </div>

              <div className="mapOptions__radioList">
                <label className="mapOptions__radio">
                  <input
                    type="radio"
                    name="valueRangeMode"
                    value="auto"
                    checked={heatmapStyle.valueRangeMode === "auto"}
                    onChange={() =>
                      setHeatmapStyle((s) => ({
                        ...s,
                        valueRangeMode: "auto",
                      }))
                    }
                  />
                  Automático (usar min/max del mapa)
                </label>

                <label className="mapOptions__radio">
                  <input
                    type="radio"
                    name="valueRangeMode"
                    value="manual"
                    checked={heatmapStyle.valueRangeMode === "manual"}
                    onChange={() =>
                      setHeatmapStyle((s) => ({
                        ...s,
                        valueRangeMode: "manual",
                      }))
                    }
                  />
                  Manual (usar valores de los marcadores)
                </label>
              </div>
            </div>

            {/* Modo de colores */}
            <div className="mapOptions__section">
              <div className="mapOptions__h11">Modo de colores</div>
              <div className="mapOptions__p10">
                Elegí entre gradiente por colores o transparencia con un solo
                color.
              </div>

              <div className="mapOptions__radioList">
                <label className="mapOptions__radio">
                  <input
                    type="radio"
                    name="fillMode"
                    value="colors"
                    checked={heatmapStyle.fillMode === "colors"}
                    onChange={() =>
                      setHeatmapStyle((s) => ({
                        ...s,
                        fillMode: "colors",
                      }))
                    }
                  />
                  Colores (gradiente con varios marcadores)
                </label>

                <label className="mapOptions__radio">
                  <input
                    type="radio"
                    name="fillMode"
                    value="opacity"
                    checked={heatmapStyle.fillMode === "opacity"}
                    onChange={() =>
                      setHeatmapStyle((s) => ({
                        ...s,
                        fillMode: "opacity",
                      }))
                    }
                  />
                  Transparencia (un solo color)
                </label>
              </div>
            </div>

            {/* Paleta personalizada */}
            {heatmapStyle.mode === "custom" &&
              heatmapStyle.fillMode === "colors" && (
                <div className="mapOptions__section mapOptions__stack">
                  <div className="mapOptions__h11">Marcadores (stops)</div>

                  <div className="mapOptions__stopsHeader">
                    <span className="mapOptions__col">Valor</span>
                    <span className="mapOptions__col">Color</span>
                    <span className="mapOptions__col mapOptions__col--right">
                      Acciones
                    </span>
                  </div>

                  {heatmapStyle.customStops.map((stop, index, arr) => {
                    const isFirst = index === 0;
                    const isLast = index === arr.length - 1;

                    const label = isFirst
                      ? "Min"
                      : isLast
                        ? "Max"
                        : `Punto ${index + 1}`;

                    return (
                      <div key={stop.id} className="mapOptions__stopRow">
                        {/* Valor */}
                        {isAuto ? (
                          <input
                            type="text"
                            value={label}
                            disabled
                            className="mapOptions__input mapOptions__input--disabled"
                          />
                        ) : (
                          <input
                            type="number"
                            value={stop.value}
                            onChange={(e) =>
                              updateStop(stop.id, {
                                value: Number(e.target.value),
                              })
                            }
                            className="mapOptions__input"
                          />
                        )}

                        {/* Color */}
                        <input
                          type="color"
                          value={stop.color}
                          onChange={(e) =>
                            updateStop(stop.id, { color: e.target.value })
                          }
                          className="mapOptions__color"
                        />

                        {/* Acciones */}
                        <div className="mapOptions__actions">
                          <button
                            type="button"
                            disabled={!canDeleteStop}
                            onClick={() => deleteStop(stop.id)}
                            className="btn btn--secondary mapOptions__btnSmall"
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addStop}
                    disabled={isAuto}
                    className="btn btn--secondary mapOptions__btnSmall"
                  >
                    Agregar
                  </button>
                </div>
              )}

            {/* Config TRANSPARENCIA */}
            {heatmapStyle.fillMode === "opacity" && (
              <div className="mapOptions__section mapOptions__stack">
                <div className="mapOptions__h11">Transparencia</div>

                <div className="mapOptions__grid2">
                  <div>
                    <div className="mapOptions__h11">Color base</div>
                    <div className="mapOptions__p10">
                      Se usa como base y se ajusta el alpha según el valor.
                    </div>
                  </div>

                  <input
                    type="color"
                    value={heatmapStyle.opacityColor}
                    onChange={(e) =>
                      setHeatmapStyle((s) => ({
                        ...s,
                        opacityColor: e.target.value,
                      }))
                    }
                    className="mapOptions__colorSmall"
                  />
                </div>

                <div className="mapOptions__gridCols2">
                  <label className="mapOptions__field">
                    <span className="mapOptions__label10">Valor mínimo</span>
                    <input
                      type="number"
                      value={heatmapStyle.opacityMin}
                      disabled={isAuto}
                      onChange={(e) =>
                        setHeatmapStyle((s) => ({
                          ...s,
                          opacityMin: Number(e.target.value),
                        }))
                      }
                      className="mapOptions__input"
                    />
                  </label>

                  <label className="mapOptions__field">
                    <span className="mapOptions__label10">Valor máximo</span>
                    <input
                      type="number"
                      value={heatmapStyle.opacityMax}
                      disabled={isAuto}
                      onChange={(e) =>
                        setHeatmapStyle((s) => ({
                          ...s,
                          opacityMax: Number(e.target.value),
                        }))
                      }
                      className="mapOptions__input"
                    />
                  </label>
                </div>

                <p className="mapOptions__p10">
                  En modo automático se usan min/max del mapa. En modo manual se
                  usa este rango para mapear la transparencia.
                </p>
              </div>
            )}

            {/* Decimales */}
            <div className="mapOptions__grid2">
              <div>
                <div className="mapOptions__h11">Decimales de barra</div>
                <div className="mapOptions__p10">
                  Formato numérico para ticks de la barra.
                </div>
              </div>

              <select
                value={heatmapStyle.tickFormat}
                onChange={(e) =>
                  setHeatmapStyle((s) => ({ ...s, tickFormat: e.target.value }))
                }
                className="mapOptions__select"
              >
                <option value=".0f">0</option>
                <option value=".1f">1</option>
                <option value=".2f">2</option>
                <option value=".3f">3</option>
                <option value=".4f">4</option>
              </select>
            </div>

            {/* Cantidad de marcas */}
            <div className="mapOptions__grid2">
              <div>
                <div className="mapOptions__h11">Cantidad de marcas</div>
                <div className="mapOptions__p10">
                  Cantidad de ticks mostrados en la barra.
                </div>
              </div>

              <input
                type="number"
                min={2}
                max={20}
                value={heatmapStyle.tickCount}
                onChange={(e) =>
                  setHeatmapStyle((s) => ({
                    ...s,
                    tickCount: Number(e.target.value),
                  }))
                }
                className="mapOptions__input mapOptions__input--full"
              />
            </div>

            {/* Grosor barra */}
            <div className="mapOptions__grid2 mapOptions__grid2--top">
              <div>
                <div className="mapOptions__h11">Grosor de la barra</div>
                <div className="mapOptions__p10">
                  Ajusta el ancho (thickness) de la colorbar.
                </div>
              </div>

              <div className="mapOptions__stack mapOptions__stack--tight">
                <input
                  type="range"
                  min={5}
                  max={40}
                  value={heatmapStyle.colorbarThickness}
                  onChange={(e) =>
                    setHeatmapStyle((s) => ({
                      ...s,
                      colorbarThickness: Number(e.target.value),
                    }))
                  }
                  className="mapOptions__range"
                />
                <div className="mapOptions__label10">
                  {heatmapStyle.colorbarThickness}px
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: GRILLA ==================== */}
      {tab === "grid" && (
        <div className="mapOptions__stack">
          <div className="mapOptions__card">
            <div className="mapOptions__row">
              <div>
                <div className="mapOptions__h11">Mostrar grilla</div>
                <div className="mapOptions__p10">
                  Activa/desactiva la grilla del mapa.
                </div>
              </div>

              <input
                type="checkbox"
                className="mapOptions__checkbox"
                checked={heatmapStyle.gridEnabled}
                onChange={(e) =>
                  setHeatmapStyle((s) => ({
                    ...s,
                    gridEnabled: e.target.checked,
                  }))
                }
              />
            </div>
          </div>

          <div className="mapOptions__card mapOptions__stack">
            <div className="mapOptions__grid2 mapOptions__grid2--top">
              <div>
                <div className="mapOptions__h11">Espaciado de grilla</div>
                <div className="mapOptions__p10">
                  Espaciado único aplicado a X e Y.
                </div>
              </div>

              <div className="mapOptions__stack mapOptions__stack--tight">
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={100}
                  value={heatmapStyle.gridSpacingX}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setHeatmapStyle((s) => ({
                      ...s,
                      gridSpacingX: v,
                      gridSpacingY: v,
                    }));
                  }}
                  className="mapOptions__range"
                />
                <div className="mapOptions__label10">
                  {heatmapStyle.gridSpacingX}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </OptionsShellModal>
  );
}
