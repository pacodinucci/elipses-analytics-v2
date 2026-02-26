// src/components/mapa/elipses-options/axis/axis-tab.tsx
import type {
  ElipsesStyle,
  ElipsesNormalizationScope,
} from "../../../../store/elipses-style";
import { Hint, SectionTitle, toHexColor } from "../shared";
import type { AxisNormByScope } from "./use-axis-tab";
import { getAutoRangeForVariable } from "../../../../hooks/use-elipses-normalization";
import { Switch } from "../switch";

type Props = {
  elipseVariables: string[];
  style: ElipsesStyle;
  onChangeStyle: (s: ElipsesStyle) => void;

  axisEnabled: boolean;

  // viene por scope (4 scopes)
  axisNormByScope: AxisNormByScope;

  yacimientoId: string | null;
  capaNombre: string | null;
  fecha: string | null;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function parseNum(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

type ScopeOrManual = ElipsesNormalizationScope | "manual";

function coerceScope(v: any): ElipsesNormalizationScope {
  if (
    v === "layer_date" ||
    v === "layer_all" ||
    v === "field_date" ||
    v === "field_all"
  )
    return v;
  return "layer_date";
}

function ModeSelect({
  value,
  disabled,
  onChange,
}: {
  value: ScopeOrManual;
  disabled?: boolean;
  onChange: (m: ScopeOrManual) => void;
}) {
  return (
    <select
      className="elipsesOpt__select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ScopeOrManual)}
    >
      <option value="layer_date">Capa - Fecha Actual</option>
      <option value="layer_all">Capa - Histórico</option>
      <option value="field_date">Yacimiento - Fecha Actual</option>
      <option value="field_all">Yacimiento - Histórico</option>
      <option value="manual">Manual</option>
    </select>
  );
}

function InputWithNormalization({
  label,
  disabledAll,

  // endpoint
  mode,
  scope,
  onChangeMode,

  variable,
  axisNormByScope,

  manualValue,
  onChangeManual,

  lastAuto,

  which, // "min" | "max"
}: {
  label: string;
  disabledAll: boolean;

  mode: "auto" | "manual";
  scope: ElipsesNormalizationScope;
  onChangeMode: (m: ScopeOrManual) => void;

  variable: string | null;
  axisNormByScope: AxisNormByScope;

  manualValue: number;
  onChangeManual: (raw: string) => void;

  lastAuto: number | null;

  which: "min" | "max";
}) {
  const editable = mode === "manual";

  const ranges = axisNormByScope[scope]?.ranges ?? {};
  const auto = getAutoRangeForVariable(ranges, variable);
  const autoValue = which === "min" ? auto.min : auto.max;

  const shown = mode === "manual" ? manualValue : (autoValue ?? lastAuto ?? "");

  return (
    <div className="elipsesOpt__grid2">
      <div className="elipsesOpt__text11">{label}</div>

      <div className="elipsesOpt__row elipsesOpt__row--tight">
        <ModeSelect
          value={mode === "manual" ? "manual" : scope}
          disabled={disabledAll}
          onChange={onChangeMode}
        />
        <input
          type="number"
          className="elipsesOpt__input"
          disabled={disabledAll || !editable}
          value={shown}
          onChange={(e) => onChangeManual(e.target.value)}
        />
      </div>
    </div>
  );
}

export function AxisTab({
  elipseVariables,
  style,
  onChangeStyle,
  axisEnabled,
  axisNormByScope,
}: Props) {
  const hasVars = elipseVariables.length > 0;

  const colorAttr = style.axisColorAttr;
  const widthAttr = style.axisWidthAttr;
  const opacityAttr = style.axisOpacityAttr;

  const axisColorVar = colorAttr.enabled ? colorAttr.variable : null;
  const axisWidthVar = widthAttr.enabled ? widthAttr.variable : null;
  const axisOpacityVar = opacityAttr.enabled ? opacityAttr.variable : null;

  const updateAxis = (fn: (s: ElipsesStyle) => ElipsesStyle) =>
    onChangeStyle(fn(style));

  const renderVarOptions = () =>
    elipseVariables.map((v) => (
      <option key={v} value={v}>
        {v}
      </option>
    ));

  const colorInvalid =
    colorAttr.enabled &&
    colorAttr.range.min.mode === "manual" &&
    colorAttr.range.max.mode === "manual" &&
    colorAttr.range.min.manual > colorAttr.range.max.manual;

  const widthInvalid =
    widthAttr.enabled &&
    widthAttr.range.min.mode === "manual" &&
    widthAttr.range.max.mode === "manual" &&
    widthAttr.range.min.manual > widthAttr.range.max.manual;

  const opacityInvalid =
    opacityAttr.enabled &&
    opacityAttr.range.min.mode === "manual" &&
    opacityAttr.range.max.mode === "manual" &&
    opacityAttr.range.min.manual > opacityAttr.range.max.manual;

  return (
    <div className="elipsesOpt__stack">
      {/* Mostrar eje */}
      <div className="elipsesOpt__card">
        <div className="elipsesOpt__row">
          <div>
            <SectionTitle>Mostrar eje</SectionTitle>
            <Hint>Línea de polo a polo para cada elipse.</Hint>
          </div>

          <Switch
            checked={axisEnabled}
            onChange={(checked) =>
              onChangeStyle({ ...style, axisEnabled: checked })
            }
            aria-label="Mostrar eje de elipses"
          />
        </div>
      </div>

      {/* ========================= COLOR ========================= */}
      <div className="elipsesOpt__card elipsesOpt__stack elipsesOpt__stack--tight">
        <div className="elipsesOpt__row">
          <div>
            <SectionTitle>Color</SectionTitle>
            <Hint>
              Activá “usar variable” para mapear color a escala. Si no, queda
              fijo.
            </Hint>
          </div>

          <div className="elipsesOpt__row elipsesOpt__row--tight">
            <div className="elipsesOpt__text11">Usar variable</div>
            <Switch
              checked={colorAttr.enabled}
              disabled={!axisEnabled}
              onChange={(checked) =>
                updateAxis((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.axisColorAttr.enabled) {
                      next.axisColorAttr = {
                        enabled: true,
                        variable: elipseVariables[0] ?? null,
                        minColor: "#00ff00",
                        maxColor: "#ff00ff",
                        range: {
                          min: {
                            mode: "auto",
                            scope: "layer_date",
                            manual: 0,
                            lastAuto: null,
                          },
                          max: {
                            mode: "auto",
                            scope: "layer_date",
                            manual: 1,
                            lastAuto: null,
                          },
                        },
                      };
                    }
                    return next;
                  }

                  const fixedSeed = next.axisColorAttr.enabled
                    ? next.axisColorAttr.minColor
                    : next.axisColorAttr.fixed.color;

                  next.axisColorAttr = {
                    enabled: false,
                    fixed: { color: fixedSeed ?? "#000000" },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para color de eje"
            />
          </div>
        </div>

        {!colorAttr.enabled ? (
          <div className="elipsesOpt__grid2">
            <div className="elipsesOpt__text11">Color fijo</div>
            <input
              type="color"
              className="elipsesOpt__color"
              disabled={!axisEnabled}
              value={toHexColor(colorAttr.fixed.color, "#000000")}
              onChange={(e) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisColorAttr.enabled) {
                    next.axisColorAttr.fixed.color = e.target.value;
                  }
                  return next;
                })
              }
            />
          </div>
        ) : (
          <>
            <div className="elipsesOpt__grid2">
              <div className="elipsesOpt__text11">Variable</div>
              <select
                className="elipsesOpt__select"
                disabled={!axisEnabled || !hasVars}
                value={
                  hasVars ? (colorAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  updateAxis((s) => {
                    const next = structuredClone(s);
                    if (next.axisColorAttr.enabled)
                      next.axisColorAttr.variable = e.target.value;
                    return next;
                  })
                }
              >
                {renderVarOptions()}
              </select>
            </div>

            <div className="elipsesOpt__grid2">
              <div className="elipsesOpt__text11">Escala</div>
              <div className="elipsesOpt__inlineColors">
                <label className="elipsesOpt__colorPair">
                  <span className="elipsesOpt__label10">Mín.</span>
                  <input
                    type="color"
                    className="elipsesOpt__color"
                    disabled={!axisEnabled}
                    value={toHexColor(colorAttr.minColor, "#00ff00")}
                    onChange={(e) =>
                      updateAxis((s) => {
                        const next = structuredClone(s);
                        if (next.axisColorAttr.enabled)
                          next.axisColorAttr.minColor = e.target.value;
                        return next;
                      })
                    }
                  />
                </label>

                <label className="elipsesOpt__colorPair">
                  <span className="elipsesOpt__label10">Máx.</span>
                  <input
                    type="color"
                    className="elipsesOpt__color"
                    disabled={!axisEnabled}
                    value={toHexColor(colorAttr.maxColor, "#ff00ff")}
                    onChange={(e) =>
                      updateAxis((s) => {
                        const next = structuredClone(s);
                        if (next.axisColorAttr.enabled)
                          next.axisColorAttr.maxColor = e.target.value;
                        return next;
                      })
                    }
                  />
                </label>
              </div>
            </div>

            <InputWithNormalization
              label="Min (dato)"
              disabledAll={!axisEnabled}
              mode={colorAttr.range.min.mode}
              scope={coerceScope(colorAttr.range.min.scope)}
              onChangeMode={(m) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisColorAttr.enabled) return next;

                  const ep = next.axisColorAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = axisNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(ranges, axisColorVar);
                    const seed = auto.min ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed)) {
                      ep.manual = seed;
                    }
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={axisColorVar}
              axisNormByScope={axisNormByScope}
              manualValue={colorAttr.range.min.manual}
              onChangeManual={(raw) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (next.axisColorAttr.enabled) {
                    next.axisColorAttr.range.min.manual = parseNum(
                      raw,
                      next.axisColorAttr.range.min.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={colorAttr.range.min.lastAuto}
              which="min"
            />

            <InputWithNormalization
              label="Max (dato)"
              disabledAll={!axisEnabled}
              mode={colorAttr.range.max.mode}
              scope={coerceScope(colorAttr.range.max.scope)}
              onChangeMode={(m) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisColorAttr.enabled) return next;

                  const ep = next.axisColorAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = axisNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(ranges, axisColorVar);
                    const seed = auto.max ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed)) {
                      ep.manual = seed;
                    }
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={axisColorVar}
              axisNormByScope={axisNormByScope}
              manualValue={colorAttr.range.max.manual}
              onChangeManual={(raw) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (next.axisColorAttr.enabled) {
                    next.axisColorAttr.range.max.manual = parseNum(
                      raw,
                      next.axisColorAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={colorAttr.range.max.lastAuto}
              which="max"
            />

            {colorInvalid && (
              <div className="elipsesOpt__errorBox">
                El mínimo no puede ser mayor que el máximo (Color).
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================= GROSOR ========================= */}
      <div className="elipsesOpt__card elipsesOpt__stack elipsesOpt__stack--tight">
        <div className="elipsesOpt__row">
          <div>
            <SectionTitle>Grosor</SectionTitle>
            <Hint>
              Activá “usar variable” para mapear grosor. Si no, queda fijo.
            </Hint>
          </div>

          <div className="elipsesOpt__row elipsesOpt__row--tight">
            <div className="elipsesOpt__text11">Usar variable</div>
            <Switch
              checked={widthAttr.enabled}
              disabled={!axisEnabled}
              onChange={(checked) =>
                updateAxis((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.axisWidthAttr.enabled) {
                      next.axisWidthAttr = {
                        enabled: true,
                        variable: elipseVariables[0] ?? null,
                        minWidth: 0.5,
                        maxWidth: 4,
                        range: {
                          min: {
                            mode: "auto",
                            scope: "layer_date",
                            manual: 0,
                            lastAuto: null,
                          },
                          max: {
                            mode: "auto",
                            scope: "layer_date",
                            manual: 1,
                            lastAuto: null,
                          },
                        },
                      };
                    }
                    return next;
                  }

                  const fixedSeed = next.axisWidthAttr.enabled
                    ? next.axisWidthAttr.minWidth
                    : next.axisWidthAttr.fixed.width;

                  next.axisWidthAttr = {
                    enabled: false,
                    fixed: { width: fixedSeed ?? 1 },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para grosor de eje"
            />
          </div>
        </div>

        {!widthAttr.enabled ? (
          <div className="elipsesOpt__grid2">
            <div className="elipsesOpt__text11">Grosor fijo (px)</div>
            <input
              type="number"
              className="elipsesOpt__input"
              disabled={!axisEnabled}
              value={widthAttr.fixed.width}
              onChange={(e) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisWidthAttr.enabled) {
                    next.axisWidthAttr.fixed.width = parseNum(
                      e.target.value,
                      next.axisWidthAttr.fixed.width,
                    );
                  }
                  return next;
                })
              }
            />
          </div>
        ) : (
          <>
            <div className="elipsesOpt__grid2">
              <div className="elipsesOpt__text11">Variable</div>
              <select
                className="elipsesOpt__select"
                disabled={!axisEnabled || !hasVars}
                value={
                  hasVars ? (widthAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  updateAxis((s) => {
                    const next = structuredClone(s);
                    if (next.axisWidthAttr.enabled)
                      next.axisWidthAttr.variable = e.target.value;
                    return next;
                  })
                }
              >
                {renderVarOptions()}
              </select>
            </div>

            <div className="elipsesOpt__grid2">
              <div className="elipsesOpt__text11">Salida (px)</div>
              <div className="elipsesOpt__cols2">
                <input
                  type="number"
                  className="elipsesOpt__input"
                  disabled={!axisEnabled}
                  value={widthAttr.minWidth}
                  onChange={(e) =>
                    updateAxis((s) => {
                      const next = structuredClone(s);
                      if (next.axisWidthAttr.enabled) {
                        next.axisWidthAttr.minWidth = parseNum(
                          e.target.value,
                          next.axisWidthAttr.minWidth,
                        );
                      }
                      return next;
                    })
                  }
                />
                <input
                  type="number"
                  className="elipsesOpt__input"
                  disabled={!axisEnabled}
                  value={widthAttr.maxWidth}
                  onChange={(e) =>
                    updateAxis((s) => {
                      const next = structuredClone(s);
                      if (next.axisWidthAttr.enabled) {
                        next.axisWidthAttr.maxWidth = parseNum(
                          e.target.value,
                          next.axisWidthAttr.maxWidth,
                        );
                      }
                      return next;
                    })
                  }
                />
              </div>
            </div>

            <InputWithNormalization
              label="Min (dato)"
              disabledAll={!axisEnabled}
              mode={widthAttr.range.min.mode}
              scope={coerceScope(widthAttr.range.min.scope)}
              onChangeMode={(m) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisWidthAttr.enabled) return next;

                  const ep = next.axisWidthAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = axisNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(ranges, axisWidthVar);
                    const seed = auto.min ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed)) {
                      ep.manual = seed;
                    }
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={axisWidthVar}
              axisNormByScope={axisNormByScope}
              manualValue={widthAttr.range.min.manual}
              onChangeManual={(raw) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (next.axisWidthAttr.enabled) {
                    next.axisWidthAttr.range.min.manual = parseNum(
                      raw,
                      next.axisWidthAttr.range.min.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={widthAttr.range.min.lastAuto}
              which="min"
            />

            <InputWithNormalization
              label="Max (dato)"
              disabledAll={!axisEnabled}
              mode={widthAttr.range.max.mode}
              scope={coerceScope(widthAttr.range.max.scope)}
              onChangeMode={(m) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisWidthAttr.enabled) return next;

                  const ep = next.axisWidthAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = axisNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(ranges, axisWidthVar);
                    const seed = auto.max ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed)) {
                      ep.manual = seed;
                    }
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={axisWidthVar}
              axisNormByScope={axisNormByScope}
              manualValue={widthAttr.range.max.manual}
              onChangeManual={(raw) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (next.axisWidthAttr.enabled) {
                    next.axisWidthAttr.range.max.manual = parseNum(
                      raw,
                      next.axisWidthAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={widthAttr.range.max.lastAuto}
              which="max"
            />

            {widthInvalid && (
              <div className="elipsesOpt__errorBox">
                El mínimo no puede ser mayor que el máximo (Grosor).
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================= OPACIDAD ========================= */}
      <div className="elipsesOpt__card elipsesOpt__stack elipsesOpt__stack--tight">
        <div className="elipsesOpt__row">
          <div>
            <SectionTitle>Opacidad</SectionTitle>
            <Hint>
              Activá “usar variable” para mapear opacidad. Si no, queda fija.
            </Hint>
          </div>

          <div className="elipsesOpt__row elipsesOpt__row--tight">
            <div className="elipsesOpt__text11">Usar variable</div>
            <Switch
              checked={opacityAttr.enabled}
              disabled={!axisEnabled}
              onChange={(checked) =>
                updateAxis((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.axisOpacityAttr.enabled) {
                      next.axisOpacityAttr = {
                        enabled: true,
                        variable: elipseVariables[0] ?? null,
                        minOpacity: 0.3,
                        maxOpacity: 1,
                        range: {
                          min: {
                            mode: "auto",
                            scope: "layer_date",
                            manual: 0,
                            lastAuto: null,
                          },
                          max: {
                            mode: "auto",
                            scope: "layer_date",
                            manual: 1,
                            lastAuto: null,
                          },
                        },
                      };
                    }
                    return next;
                  }

                  const fixedSeed = next.axisOpacityAttr.enabled
                    ? next.axisOpacityAttr.maxOpacity
                    : next.axisOpacityAttr.fixed.opacity;

                  next.axisOpacityAttr = {
                    enabled: false,
                    fixed: { opacity: clamp01(fixedSeed ?? 1) },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para opacidad de eje"
            />
          </div>
        </div>

        {!opacityAttr.enabled ? (
          <div className="elipsesOpt__grid2">
            <div className="elipsesOpt__text11">Opacidad fija (0..1)</div>
            <input
              type="number"
              step={0.05}
              className="elipsesOpt__input"
              disabled={!axisEnabled}
              value={opacityAttr.fixed.opacity}
              onChange={(e) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisOpacityAttr.enabled) {
                    next.axisOpacityAttr.fixed.opacity = clamp01(
                      parseNum(
                        e.target.value,
                        next.axisOpacityAttr.fixed.opacity,
                      ),
                    );
                  }
                  return next;
                })
              }
            />
          </div>
        ) : (
          <>
            <div className="elipsesOpt__grid2">
              <div className="elipsesOpt__text11">Variable</div>
              <select
                className="elipsesOpt__select"
                disabled={!axisEnabled || !hasVars}
                value={
                  hasVars ? (opacityAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  updateAxis((s) => {
                    const next = structuredClone(s);
                    if (next.axisOpacityAttr.enabled)
                      next.axisOpacityAttr.variable = e.target.value;
                    return next;
                  })
                }
              >
                {renderVarOptions()}
              </select>
            </div>

            <div className="elipsesOpt__grid2">
              <div className="elipsesOpt__text11">Salida (0..1)</div>
              <div className="elipsesOpt__cols2">
                <input
                  type="number"
                  step={0.05}
                  className="elipsesOpt__input"
                  disabled={!axisEnabled}
                  value={opacityAttr.minOpacity}
                  onChange={(e) =>
                    updateAxis((s) => {
                      const next = structuredClone(s);
                      if (next.axisOpacityAttr.enabled) {
                        next.axisOpacityAttr.minOpacity = clamp01(
                          parseNum(
                            e.target.value,
                            next.axisOpacityAttr.minOpacity,
                          ),
                        );
                      }
                      return next;
                    })
                  }
                />
                <input
                  type="number"
                  step={0.05}
                  className="elipsesOpt__input"
                  disabled={!axisEnabled}
                  value={opacityAttr.maxOpacity}
                  onChange={(e) =>
                    updateAxis((s) => {
                      const next = structuredClone(s);
                      if (next.axisOpacityAttr.enabled) {
                        next.axisOpacityAttr.maxOpacity = clamp01(
                          parseNum(
                            e.target.value,
                            next.axisOpacityAttr.maxOpacity,
                          ),
                        );
                      }
                      return next;
                    })
                  }
                />
              </div>
            </div>

            <InputWithNormalization
              label="Min (dato)"
              disabledAll={!axisEnabled}
              mode={opacityAttr.range.min.mode}
              scope={coerceScope(opacityAttr.range.min.scope)}
              onChangeMode={(m) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisOpacityAttr.enabled) return next;

                  const ep = next.axisOpacityAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = axisNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      axisOpacityVar,
                    );
                    const seed = auto.min ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed)) {
                      ep.manual = seed;
                    }
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={axisOpacityVar}
              axisNormByScope={axisNormByScope}
              manualValue={opacityAttr.range.min.manual}
              onChangeManual={(raw) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (next.axisOpacityAttr.enabled) {
                    next.axisOpacityAttr.range.min.manual = parseNum(
                      raw,
                      next.axisOpacityAttr.range.min.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={opacityAttr.range.min.lastAuto}
              which="min"
            />

            <InputWithNormalization
              label="Max (dato)"
              disabledAll={!axisEnabled}
              mode={opacityAttr.range.max.mode}
              scope={coerceScope(opacityAttr.range.max.scope)}
              onChangeMode={(m) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (!next.axisOpacityAttr.enabled) return next;

                  const ep = next.axisOpacityAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = axisNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      axisOpacityVar,
                    );
                    const seed = auto.max ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed)) {
                      ep.manual = seed;
                    }
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={axisOpacityVar}
              axisNormByScope={axisNormByScope}
              manualValue={opacityAttr.range.max.manual}
              onChangeManual={(raw) =>
                updateAxis((s) => {
                  const next = structuredClone(s);
                  if (next.axisOpacityAttr.enabled) {
                    next.axisOpacityAttr.range.max.manual = parseNum(
                      raw,
                      next.axisOpacityAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={opacityAttr.range.max.lastAuto}
              which="max"
            />

            {opacityInvalid && (
              <div className="elipsesOpt__errorBox">
                El mínimo no puede ser mayor que el máximo (Opacidad).
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
