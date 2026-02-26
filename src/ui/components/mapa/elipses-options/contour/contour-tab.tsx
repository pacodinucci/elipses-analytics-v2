// src/components/mapa/elipses-options/contour/contour-tab.tsx
import type {
  ElipsesStyle,
  ElipsesNormalizationScope,
} from "../../../../store/elipses-style";
import { Hint, SectionTitle, toHexColor } from "../shared";
import type { ContourNormByScope } from "./use-contour-tab";
import { getAutoRangeForVariable } from "../../../../hooks/use-elipses-normalization";
import { Switch } from "../switch";

type Props = {
  elipseVariables: string[];
  style: ElipsesStyle;
  onChangeStyle: (s: ElipsesStyle) => void;

  contourEnabled: boolean;
  contourNormByScope: ContourNormByScope;

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

  mode,
  scope,
  onChangeMode,

  variable,
  normByScope,

  manualValue,
  onChangeManual,

  lastAuto,

  which,
}: {
  label: string;
  disabledAll: boolean;

  mode: "auto" | "manual";
  scope: ElipsesNormalizationScope;
  onChangeMode: (m: ScopeOrManual) => void;

  variable: string | null;
  normByScope: ContourNormByScope;

  manualValue: number;
  onChangeManual: (raw: string) => void;

  lastAuto: number | null;
  which: "min" | "max";
}) {
  const editable = mode === "manual";

  const ranges = normByScope[scope]?.ranges ?? {};
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

export function ContourTab({
  elipseVariables,
  style,
  onChangeStyle,
  contourEnabled,
  contourNormByScope,
}: Props) {
  const hasVars = elipseVariables.length > 0;

  const colorAttr = style.contourColorAttr;
  const widthAttr = style.contourWidthAttr;
  const opacityAttr = style.contourOpacityAttr;

  const contourColorVar = colorAttr.enabled ? colorAttr.variable : null;
  const contourWidthVar = widthAttr.enabled ? widthAttr.variable : null;
  const contourOpacityVar = opacityAttr.enabled ? opacityAttr.variable : null;

  const update = (fn: (s: ElipsesStyle) => ElipsesStyle) =>
    onChangeStyle(fn(style));

  const renderVarOptions = () =>
    elipseVariables.map((v) => (
      <option key={v} value={v}>
        {v}
      </option>
    ));

  const contourColorInvalid =
    colorAttr.enabled &&
    colorAttr.range.min.mode === "manual" &&
    colorAttr.range.max.mode === "manual" &&
    colorAttr.range.min.manual > colorAttr.range.max.manual;

  const contourWidthInvalid =
    widthAttr.enabled &&
    widthAttr.range.min.mode === "manual" &&
    widthAttr.range.max.mode === "manual" &&
    widthAttr.range.min.manual > widthAttr.range.max.manual;

  const contourOpacityInvalid =
    opacityAttr.enabled &&
    opacityAttr.range.min.mode === "manual" &&
    opacityAttr.range.max.mode === "manual" &&
    opacityAttr.range.min.manual > opacityAttr.range.max.manual;

  return (
    <div className="elipsesOpt__stack">
      {/* Mostrar contorno */}
      <div className="elipsesOpt__card">
        <div className="elipsesOpt__row">
          <div>
            <SectionTitle>Mostrar contorno</SectionTitle>
            <Hint>Contorno (stroke) de cada elipse.</Hint>
          </div>

          <Switch
            checked={contourEnabled}
            onChange={(checked) =>
              onChangeStyle({ ...style, contourEnabled: checked })
            }
            aria-label="Mostrar contorno de elipses"
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
              disabled={!contourEnabled}
              onChange={(checked) =>
                update((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.contourColorAttr.enabled) {
                      next.contourColorAttr = {
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

                  const fixedSeed = next.contourColorAttr.enabled
                    ? next.contourColorAttr.minColor
                    : next.contourColorAttr.fixed.color;

                  next.contourColorAttr = {
                    enabled: false,
                    fixed: { color: fixedSeed ?? "#00ff00" },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para color de contorno"
            />
          </div>
        </div>

        {!colorAttr.enabled ? (
          <div className="elipsesOpt__grid2">
            <div className="elipsesOpt__text11">Color fijo</div>
            <input
              type="color"
              className="elipsesOpt__color"
              disabled={!contourEnabled}
              value={toHexColor(colorAttr.fixed.color, "#00ff00")}
              onChange={(e) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourColorAttr.enabled) {
                    next.contourColorAttr.fixed.color = e.target.value;
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
                disabled={!contourEnabled || !hasVars}
                value={
                  hasVars ? (colorAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  update((s) => {
                    const next = structuredClone(s);
                    if (next.contourColorAttr.enabled)
                      next.contourColorAttr.variable = e.target.value;
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
                    disabled={!contourEnabled}
                    value={toHexColor(colorAttr.minColor, "#00ff00")}
                    onChange={(e) =>
                      update((s) => {
                        const next = structuredClone(s);
                        if (next.contourColorAttr.enabled)
                          next.contourColorAttr.minColor = e.target.value;
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
                    disabled={!contourEnabled}
                    value={toHexColor(colorAttr.maxColor, "#ff00ff")}
                    onChange={(e) =>
                      update((s) => {
                        const next = structuredClone(s);
                        if (next.contourColorAttr.enabled)
                          next.contourColorAttr.maxColor = e.target.value;
                        return next;
                      })
                    }
                  />
                </label>
              </div>
            </div>

            <InputWithNormalization
              label="Min (dato)"
              disabledAll={!contourEnabled}
              mode={colorAttr.range.min.mode}
              scope={coerceScope(colorAttr.range.min.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourColorAttr.enabled) return next;

                  const ep = next.contourColorAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = contourNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      contourColorVar,
                    );
                    const seed = auto.min ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed))
                      ep.manual = seed;
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={contourColorVar}
              normByScope={contourNormByScope}
              manualValue={colorAttr.range.min.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.contourColorAttr.enabled) {
                    next.contourColorAttr.range.min.manual = parseNum(
                      raw,
                      next.contourColorAttr.range.min.manual,
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
              disabledAll={!contourEnabled}
              mode={colorAttr.range.max.mode}
              scope={coerceScope(colorAttr.range.max.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourColorAttr.enabled) return next;

                  const ep = next.contourColorAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = contourNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      contourColorVar,
                    );
                    const seed = auto.max ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed))
                      ep.manual = seed;
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={contourColorVar}
              normByScope={contourNormByScope}
              manualValue={colorAttr.range.max.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.contourColorAttr.enabled) {
                    next.contourColorAttr.range.max.manual = parseNum(
                      raw,
                      next.contourColorAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={colorAttr.range.max.lastAuto}
              which="max"
            />

            {contourColorInvalid && (
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
              disabled={!contourEnabled}
              onChange={(checked) =>
                update((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.contourWidthAttr.enabled) {
                      next.contourWidthAttr = {
                        enabled: true,
                        variable: elipseVariables[0] ?? null,
                        minWidth: 0.5,
                        maxWidth: 3,
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

                  const fixedSeed = next.contourWidthAttr.enabled
                    ? next.contourWidthAttr.minWidth
                    : next.contourWidthAttr.fixed.width;

                  next.contourWidthAttr = {
                    enabled: false,
                    fixed: { width: fixedSeed ?? 1 },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para grosor de contorno"
            />
          </div>
        </div>

        {!widthAttr.enabled ? (
          <div className="elipsesOpt__grid2">
            <div className="elipsesOpt__text11">Grosor fijo (px)</div>
            <input
              type="number"
              className="elipsesOpt__input"
              disabled={!contourEnabled}
              value={widthAttr.fixed.width}
              onChange={(e) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourWidthAttr.enabled) {
                    next.contourWidthAttr.fixed.width = parseNum(
                      e.target.value,
                      next.contourWidthAttr.fixed.width,
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
                disabled={!contourEnabled || !hasVars}
                value={
                  hasVars ? (widthAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  update((s) => {
                    const next = structuredClone(s);
                    if (next.contourWidthAttr.enabled)
                      next.contourWidthAttr.variable = e.target.value;
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
                  disabled={!contourEnabled}
                  value={widthAttr.minWidth}
                  onChange={(e) =>
                    update((s) => {
                      const next = structuredClone(s);
                      if (next.contourWidthAttr.enabled) {
                        next.contourWidthAttr.minWidth = parseNum(
                          e.target.value,
                          next.contourWidthAttr.minWidth,
                        );
                      }
                      return next;
                    })
                  }
                />
                <input
                  type="number"
                  className="elipsesOpt__input"
                  disabled={!contourEnabled}
                  value={widthAttr.maxWidth}
                  onChange={(e) =>
                    update((s) => {
                      const next = structuredClone(s);
                      if (next.contourWidthAttr.enabled) {
                        next.contourWidthAttr.maxWidth = parseNum(
                          e.target.value,
                          next.contourWidthAttr.maxWidth,
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
              disabledAll={!contourEnabled}
              mode={widthAttr.range.min.mode}
              scope={coerceScope(widthAttr.range.min.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourWidthAttr.enabled) return next;

                  const ep = next.contourWidthAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = contourNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      contourWidthVar,
                    );
                    const seed = auto.min ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed))
                      ep.manual = seed;
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={contourWidthVar}
              normByScope={contourNormByScope}
              manualValue={widthAttr.range.min.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.contourWidthAttr.enabled) {
                    next.contourWidthAttr.range.min.manual = parseNum(
                      raw,
                      next.contourWidthAttr.range.min.manual,
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
              disabledAll={!contourEnabled}
              mode={widthAttr.range.max.mode}
              scope={coerceScope(widthAttr.range.max.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourWidthAttr.enabled) return next;

                  const ep = next.contourWidthAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = contourNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      contourWidthVar,
                    );
                    const seed = auto.max ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed))
                      ep.manual = seed;
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={contourWidthVar}
              normByScope={contourNormByScope}
              manualValue={widthAttr.range.max.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.contourWidthAttr.enabled) {
                    next.contourWidthAttr.range.max.manual = parseNum(
                      raw,
                      next.contourWidthAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={widthAttr.range.max.lastAuto}
              which="max"
            />

            {contourWidthInvalid && (
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
              disabled={!contourEnabled}
              onChange={(checked) =>
                update((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.contourOpacityAttr.enabled) {
                      next.contourOpacityAttr = {
                        enabled: true,
                        variable: elipseVariables[0] ?? null,
                        minOpacity: 0.2,
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

                  const fixedSeed = next.contourOpacityAttr.enabled
                    ? next.contourOpacityAttr.maxOpacity
                    : next.contourOpacityAttr.fixed.opacity;

                  next.contourOpacityAttr = {
                    enabled: false,
                    fixed: { opacity: clamp01(fixedSeed ?? 1) },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para opacidad de contorno"
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
              disabled={!contourEnabled}
              value={opacityAttr.fixed.opacity}
              onChange={(e) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourOpacityAttr.enabled) {
                    next.contourOpacityAttr.fixed.opacity = clamp01(
                      parseNum(
                        e.target.value,
                        next.contourOpacityAttr.fixed.opacity,
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
                disabled={!contourEnabled || !hasVars}
                value={
                  hasVars ? (opacityAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  update((s) => {
                    const next = structuredClone(s);
                    if (next.contourOpacityAttr.enabled)
                      next.contourOpacityAttr.variable = e.target.value;
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
                  disabled={!contourEnabled}
                  value={opacityAttr.minOpacity}
                  onChange={(e) =>
                    update((s) => {
                      const next = structuredClone(s);
                      if (next.contourOpacityAttr.enabled) {
                        next.contourOpacityAttr.minOpacity = clamp01(
                          parseNum(
                            e.target.value,
                            next.contourOpacityAttr.minOpacity,
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
                  disabled={!contourEnabled}
                  value={opacityAttr.maxOpacity}
                  onChange={(e) =>
                    update((s) => {
                      const next = structuredClone(s);
                      if (next.contourOpacityAttr.enabled) {
                        next.contourOpacityAttr.maxOpacity = clamp01(
                          parseNum(
                            e.target.value,
                            next.contourOpacityAttr.maxOpacity,
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
              disabledAll={!contourEnabled}
              mode={opacityAttr.range.min.mode}
              scope={coerceScope(opacityAttr.range.min.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourOpacityAttr.enabled) return next;

                  const ep = next.contourOpacityAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = contourNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      contourOpacityVar,
                    );
                    const seed = auto.min ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed))
                      ep.manual = seed;
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={contourOpacityVar}
              normByScope={contourNormByScope}
              manualValue={opacityAttr.range.min.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.contourOpacityAttr.enabled) {
                    next.contourOpacityAttr.range.min.manual = parseNum(
                      raw,
                      next.contourOpacityAttr.range.min.manual,
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
              disabledAll={!contourEnabled}
              mode={opacityAttr.range.max.mode}
              scope={coerceScope(opacityAttr.range.max.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.contourOpacityAttr.enabled) return next;

                  const ep = next.contourOpacityAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = contourNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      contourOpacityVar,
                    );
                    const seed = auto.max ?? ep.lastAuto ?? ep.manual;
                    if (typeof seed === "number" && Number.isFinite(seed))
                      ep.manual = seed;
                    ep.mode = "manual";
                  } else {
                    ep.mode = "auto";
                    ep.scope = m;
                  }

                  return next;
                })
              }
              variable={contourOpacityVar}
              normByScope={contourNormByScope}
              manualValue={opacityAttr.range.max.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.contourOpacityAttr.enabled) {
                    next.contourOpacityAttr.range.max.manual = parseNum(
                      raw,
                      next.contourOpacityAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={opacityAttr.range.max.lastAuto}
              which="max"
            />

            {contourOpacityInvalid && (
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
