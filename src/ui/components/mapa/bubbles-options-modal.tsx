// src/components/mapa/bubbles-options-modal.tsx
import * as React from "react";
import { useMemo } from "react";
import { OptionsShellModal, type OptionsNavItem } from "./options-shell-modal";
import type {
  BubblesStyleConfig,
  BubbleMetric,
} from "../../store/bubbles-style";
import type {
  BubblePieKey,
  BubbleRenderMode,
} from "../../viewer/engine/layers/bubbles/bubbles-layer";

import "./pozos-options-modal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;

  metric: BubbleMetric;
  onChangeMetric: (metric: BubbleMetric) => void;

  config: BubblesStyleConfig;
  onChangeConfig: (
    updater:
      | BubblesStyleConfig
      | ((prev: BubblesStyleConfig) => BubblesStyleConfig),
  ) => void;

  onReset: () => void;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="pozosOpt__h11">{children}</div>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="pozosOpt__p10">{children}</div>;
}

const IconBubble = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
  </svg>
);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ✅ v2 (ValorEscenario): petroleo, agua, gas, inyeccionAgua, inyeccionGas
const METRICS: Array<{ value: BubbleMetric; label: string }> = [
  { value: "petroleo", label: "Petróleo" },
  { value: "agua", label: "Agua" },
  { value: "gas", label: "Gas" },
  { value: "inyeccionAgua", label: "Agua inyectada" },
  { value: "inyeccionGas", label: "Gas inyectado" },
];

const PIE_KEYS: Array<{ key: BubblePieKey; label: string }> = [
  { key: "petroleo", label: "Petróleo" },
  { key: "agua", label: "Agua" },
  { key: "gas", label: "Gas" },
  { key: "inyeccionAgua", label: "Agua inyectada" },
  { key: "inyeccionGas", label: "Gas inyectado" },
];

const DEFAULT_PIE_COLORS: Record<BubblePieKey, string> = {
  petroleo: "#2b2b2b",
  agua: "#2f80ed",
  gas: "#f2c94c",
  inyeccionAgua: "#56ccf2",
  inyeccionGas: "#9b51e0",
};

function safeColorString(v: unknown, fallback: string) {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t ? t : fallback;
}

function safeNum(v: unknown, fallback: number) {
  const n =
    typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function BubblesOptionsModal({
  isOpen,
  onClose,
  metric,
  onChangeMetric,
  config,
  onChangeConfig,
  onReset,
}: Props) {
  const items: OptionsNavItem<"visual">[] = useMemo(
    () => [
      {
        key: "visual",
        title: "Visual",
        subtitle: "Modo, tamaño, opacidad y colores",
        icon: <IconBubble />,
      },
    ],
    [],
  );

  if (!isOpen) return null;

  const renderMode: BubbleRenderMode = (config.renderMode ??
    "circle") as BubbleRenderMode;
  const pieKeys = (config.pieKeys ?? []) as BubblePieKey[];
  const pieColors = (config.pieColors ?? {}) as Partial<
    Record<BubblePieKey, string>
  >;

  const setNumberKey = <K extends keyof BubblesStyleConfig>(
    key: K,
    raw: string,
    min: number,
    max: number,
  ) => {
    const v = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(v)) return;
    onChangeConfig((prev) => ({
      ...prev,
      [key]: clamp(v, min, max) as BubblesStyleConfig[K],
    }));
  };

  const setPieNumberKey = <K extends "pieMinTotal" | "pieInnerRadiusRatio">(
    key: K,
    raw: string,
    min: number,
    max: number,
  ) => {
    const v = safeNum(raw, 0);
    onChangeConfig((prev) => ({
      ...prev,
      [key]: clamp(v, min, max),
    }));
  };

  const togglePieKey = (k: BubblePieKey, on: boolean) => {
    onChangeConfig((prev) => {
      const cur = new Set<BubblePieKey>((prev.pieKeys ?? []) as BubblePieKey[]);
      if (on) cur.add(k);
      else cur.delete(k);

      // orden estable
      const ordered = PIE_KEYS.map((x) => x.key).filter((kk) => cur.has(kk));
      return { ...prev, pieKeys: ordered };
    });
  };

  const setPieColor = (k: BubblePieKey, color: string) => {
    onChangeConfig((prev) => ({
      ...prev,
      pieColors: { ...(prev.pieColors ?? {}), [k]: color },
    }));
  };

  const setRenderMode = (mode: BubbleRenderMode) => {
    onChangeConfig((prev) => {
      // defaults razonables al entrar a pie
      if (mode === "pie") {
        const nextPieKeys = (
          prev.pieKeys?.length ? prev.pieKeys : PIE_KEYS.map((x) => x.key)
        ) as BubblePieKey[];

        const nextPieColors = { ...(prev.pieColors ?? {}) } as Partial<
          Record<BubblePieKey, string>
        >;

        for (const kk of nextPieKeys) {
          if (!nextPieColors[kk]) nextPieColors[kk] = DEFAULT_PIE_COLORS[kk];
        }

        return {
          ...prev,
          renderMode: "pie",
          pieKeys: nextPieKeys,
          pieColors: nextPieColors,
          pieMinTotal: Number.isFinite(prev.pieMinTotal as any)
            ? prev.pieMinTotal
            : 0,
          pieInnerRadiusRatio: Number.isFinite(prev.pieInnerRadiusRatio as any)
            ? prev.pieInnerRadiusRatio
            : 0,
        };
      }

      // circle: no borramos pie config (por si vuelve), solo cambiamos mode
      return { ...prev, renderMode: "circle" };
    });
  };

  const effectivePieMinTotal = safeNum(config.pieMinTotal, 0);
  const effectiveInnerRatio = clamp(
    safeNum(config.pieInnerRadiusRatio, 0),
    0,
    0.9,
  );

  return (
    <OptionsShellModal<"visual">
      isOpen={isOpen}
      onClose={onClose}
      title="Opciones de burbujas"
      items={items}
      activeKey={"visual"}
      onChangeKey={() => {}}
      panelTitle="Visual"
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
      <div className="pozosOpt__stack">
        {/* Mostrar */}
        <div className="pozosOpt__card">
          <div className="pozosOpt__row">
            <div>
              <SectionTitle>Mostrar burbujas</SectionTitle>
              <Hint>Activa o desactiva la capa de burbujas.</Hint>
            </div>
            <input
              type="checkbox"
              className="pozosOpt__checkbox"
              checked={!!config.enabled}
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  enabled: e.target.checked,
                }))
              }
            />
          </div>
        </div>

        {/* Visual */}
        <div className="pozosOpt__card pozosOpt__stack pozosOpt__stack--tight">
          {/* Modo */}
          <div className="pozosOpt__grid2">
            <div>
              <SectionTitle>Modo</SectionTitle>
              <Hint>
                Básico = círculo sólido. Pie chart = porciones por variable.
              </Hint>
            </div>

            <select
              className="pozosOpt__select pozosOpt__select--full"
              value={renderMode}
              onChange={(e) =>
                setRenderMode(e.target.value as BubbleRenderMode)
              }
            >
              <option value="circle">Básico</option>
              <option value="pie">Pie chart</option>
            </select>
          </div>

          {/* ✅ OPCIONES QUE VARÍAN SEGÚN MODO */}
          {renderMode === "circle" ? (
            <>
              {/* Métrica */}
              <div className="pozosOpt__grid2">
                <div>
                  <SectionTitle>Métrica</SectionTitle>
                  <Hint>Columna usada como valor de la burbuja.</Hint>
                </div>

                <select
                  className="pozosOpt__select pozosOpt__select--full"
                  value={metric}
                  onChange={(e) =>
                    onChangeMetric(e.target.value as BubbleMetric)
                  }
                >
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color base */}
              <div className="pozosOpt__grid2">
                <div>
                  <SectionTitle>Color</SectionTitle>
                  <Hint>Color base de la burbuja en modo Básico.</Hint>
                </div>

                <input
                  type="color"
                  value={safeColorString(config.color, "#22c55e")}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      color: e.target.value,
                    }))
                  }
                  className="pozosOpt__color"
                />
              </div>
            </>
          ) : (
            <>
              {/* Pie keys + colors */}
              <div className="pozosOpt__grid2">
                <div>
                  <SectionTitle>Variables del pie</SectionTitle>
                  <Hint>Activá variables y definí su color.</Hint>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {PIE_KEYS.map(({ key, label }) => {
                    const checked = pieKeys.includes(key);
                    const color = safeColorString(
                      pieColors[key] ?? DEFAULT_PIE_COLORS[key] ?? "#000000",
                      DEFAULT_PIE_COLORS[key] ?? "#000000",
                    );

                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <input
                            type="checkbox"
                            className="pozosOpt__checkbox"
                            checked={checked}
                            onChange={(e) =>
                              togglePieKey(key, e.target.checked)
                            }
                          />
                          <span style={{ fontSize: 12 }}>{label}</span>
                        </label>

                        <input
                          type="color"
                          value={color}
                          disabled={!checked}
                          onChange={(e) => setPieColor(key, e.target.value)}
                          className="pozosOpt__color"
                          style={{ opacity: checked ? 1 : 0.35 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* pieMinTotal */}
              <div className="pozosOpt__grid2">
                <div>
                  <SectionTitle>Pie mínimo</SectionTitle>
                  <Hint>
                    Si el total del pie es ≤ este valor, se dibuja como círculo
                    (fallback).
                  </Hint>
                </div>

                <input
                  type="number"
                  min={0}
                  max={1_000_000_000}
                  step={1}
                  value={effectivePieMinTotal}
                  onChange={(e) =>
                    setPieNumberKey(
                      "pieMinTotal",
                      e.target.value,
                      0,
                      1_000_000_000,
                    )
                  }
                  className="pozosOpt__input pozosOpt__input--full"
                />
              </div>

              {/* pieInnerRadiusRatio */}
              <div className="pozosOpt__grid2">
                <div>
                  <SectionTitle>Donut</SectionTitle>
                  <Hint>0 = pie normal. &gt;0 = agujero interno (0..0.9).</Hint>
                </div>

                <input
                  type="number"
                  min={0}
                  max={0.9}
                  step={0.05}
                  value={effectiveInnerRatio}
                  onChange={(e) =>
                    setPieNumberKey(
                      "pieInnerRadiusRatio",
                      e.target.value,
                      0,
                      0.9,
                    )
                  }
                  className="pozosOpt__input pozosOpt__input--full"
                />
              </div>
            </>
          )}

          {/* Radius min/max (común) */}
          <div className="pozosOpt__grid2">
            <div>
              <SectionTitle>Radio mínimo</SectionTitle>
              <Hint>En píxeles.</Hint>
            </div>

            <input
              type="number"
              min={1}
              max={200}
              step={1}
              value={config.minRadius}
              onChange={(e) =>
                setNumberKey("minRadius", e.target.value, 1, 200)
              }
              className="pozosOpt__input pozosOpt__input--full"
            />
          </div>

          <div className="pozosOpt__grid2">
            <div>
              <SectionTitle>Radio máximo</SectionTitle>
              <Hint>En píxeles.</Hint>
            </div>

            <input
              type="number"
              min={1}
              max={400}
              step={1}
              value={config.maxRadius}
              onChange={(e) =>
                setNumberKey("maxRadius", e.target.value, 1, 400)
              }
              className="pozosOpt__input pozosOpt__input--full"
            />
          </div>

          {/* Opacity (común) */}
          <div className="pozosOpt__grid2">
            <div>
              <SectionTitle>Opacidad</SectionTitle>
              <Hint>0..1</Hint>
            </div>

            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.opacity}
              onChange={(e) => setNumberKey("opacity", e.target.value, 0, 1)}
              className="pozosOpt__input pozosOpt__input--full"
            />
          </div>

          {/* Border color (común) */}
          <div className="pozosOpt__grid2">
            <div>
              <SectionTitle>Borde (color)</SectionTitle>
              <Hint>Color del contorno.</Hint>
            </div>

            <input
              type="color"
              value={safeColorString(config.borderColor, "#1f2937")}
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  borderColor: e.target.value,
                }))
              }
              className="pozosOpt__color"
            />
          </div>

          {/* Border width (común) */}
          <div className="pozosOpt__grid2">
            <div>
              <SectionTitle>Borde (grosor)</SectionTitle>
              <Hint>En píxeles.</Hint>
            </div>

            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={config.borderWidth}
              onChange={(e) =>
                setNumberKey("borderWidth", e.target.value, 0, 10)
              }
              className="pozosOpt__input pozosOpt__input--full"
            />
          </div>
        </div>
      </div>
    </OptionsShellModal>
  );
}
