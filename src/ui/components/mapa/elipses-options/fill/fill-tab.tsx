// src/components/mapa/elipses-options/fill/fill-tab.tsx
import type {
  ElipsesStyle,
  ElipsesNormalizationScope,
} from "../../../../store/elipses-style";
import { Hint, SectionTitle, toHexColor } from "../shared";
import type { FillNormByScope } from "./use-fill-tab";
import { getAutoRangeForVariable } from "../../../../hooks/use-elipses-normalization";
import { Switch } from "../switch";

type Props = {
  elipseVariables: string[];
  style: ElipsesStyle;
  onChangeStyle: (s: ElipsesStyle) => void;

  fillEnabled: boolean;
  fillNormByScope: FillNormByScope;

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
  normByScope: FillNormByScope;

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

export function FillTab({
  elipseVariables,
  style,
  onChangeStyle,
  fillEnabled,
  fillNormByScope,
}: Props) {
  const hasVars = elipseVariables.length > 0;

  const colorAttr = style.fillColorAttr;
  const opacityAttr = style.fillOpacityAttr;

  const fillColorVar = colorAttr.enabled ? colorAttr.variable : null;
  const fillOpacityVar = opacityAttr.enabled ? opacityAttr.variable : null;

  const update = (fn: (s: ElipsesStyle) => ElipsesStyle) =>
    onChangeStyle(fn(style));

  const renderVarOptions = () =>
    elipseVariables.map((v) => (
      <option key={v} value={v}>
        {v}
      </option>
    ));

  const fillColorInvalid =
    colorAttr.enabled &&
    colorAttr.range.min.mode === "manual" &&
    colorAttr.range.max.mode === "manual" &&
    colorAttr.range.min.manual > colorAttr.range.max.manual;

  const fillOpacityInvalid =
    opacityAttr.enabled &&
    opacityAttr.range.min.mode === "manual" &&
    opacityAttr.range.max.mode === "manual" &&
    opacityAttr.range.min.manual > opacityAttr.range.max.manual;

  return (
    <div className="elipsesOpt__stack">
      {/* Mostrar relleno */}
      <div className="elipsesOpt__card">
        <div className="elipsesOpt__row">
          <div>
            <SectionTitle>Mostrar relleno</SectionTitle>
            <Hint>Activa/desactiva el relleno dentro de las elipses.</Hint>
          </div>

          <Switch
            checked={fillEnabled}
            onChange={(checked) =>
              onChangeStyle({ ...style, fillEnabled: checked })
            }
            aria-label="Mostrar relleno de elipses"
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
              disabled={!fillEnabled}
              onChange={(checked) =>
                update((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.fillColorAttr.enabled) {
                      next.fillColorAttr = {
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

                  const fixedSeed = next.fillColorAttr.enabled
                    ? next.fillColorAttr.minColor
                    : next.fillColorAttr.fixed.color;

                  next.fillColorAttr = {
                    enabled: false,
                    fixed: { color: fixedSeed ?? "#000000" },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para color"
            />
          </div>
        </div>

        {!colorAttr.enabled ? (
          <div className="elipsesOpt__grid2">
            <div className="elipsesOpt__text11">Color fijo</div>
            <input
              type="color"
              className="elipsesOpt__color"
              disabled={!fillEnabled}
              value={toHexColor(colorAttr.fixed.color, "#000000")}
              onChange={(e) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.fillColorAttr.enabled) {
                    next.fillColorAttr.fixed.color = e.target.value;
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
                disabled={!fillEnabled || !hasVars}
                value={
                  hasVars ? (colorAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  update((s) => {
                    const next = structuredClone(s);
                    if (next.fillColorAttr.enabled)
                      next.fillColorAttr.variable = e.target.value;
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
                    disabled={!fillEnabled}
                    value={toHexColor(colorAttr.minColor, "#00ff00")}
                    onChange={(e) =>
                      update((s) => {
                        const next = structuredClone(s);
                        if (next.fillColorAttr.enabled)
                          next.fillColorAttr.minColor = e.target.value;
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
                    disabled={!fillEnabled}
                    value={toHexColor(colorAttr.maxColor, "#ff00ff")}
                    onChange={(e) =>
                      update((s) => {
                        const next = structuredClone(s);
                        if (next.fillColorAttr.enabled)
                          next.fillColorAttr.maxColor = e.target.value;
                        return next;
                      })
                    }
                  />
                </label>
              </div>
            </div>

            <InputWithNormalization
              label="Min (dato)"
              disabledAll={!fillEnabled}
              mode={colorAttr.range.min.mode}
              scope={coerceScope(colorAttr.range.min.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.fillColorAttr.enabled) return next;

                  const ep = next.fillColorAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = fillNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(ranges, fillColorVar);
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
              variable={fillColorVar}
              normByScope={fillNormByScope}
              manualValue={colorAttr.range.min.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.fillColorAttr.enabled) {
                    next.fillColorAttr.range.min.manual = parseNum(
                      raw,
                      next.fillColorAttr.range.min.manual,
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
              disabledAll={!fillEnabled}
              mode={colorAttr.range.max.mode}
              scope={coerceScope(colorAttr.range.max.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.fillColorAttr.enabled) return next;

                  const ep = next.fillColorAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = fillNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(ranges, fillColorVar);
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
              variable={fillColorVar}
              normByScope={fillNormByScope}
              manualValue={colorAttr.range.max.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.fillColorAttr.enabled) {
                    next.fillColorAttr.range.max.manual = parseNum(
                      raw,
                      next.fillColorAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={colorAttr.range.max.lastAuto}
              which="max"
            />

            {fillColorInvalid && (
              <div className="elipsesOpt__errorBox">
                El mínimo no puede ser mayor que el máximo (Color).
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
              disabled={!fillEnabled}
              onChange={(checked) =>
                update((s) => {
                  const next = structuredClone(s);

                  if (checked) {
                    if (!next.fillOpacityAttr.enabled) {
                      next.fillOpacityAttr = {
                        enabled: true,
                        variable: elipseVariables[0] ?? null,
                        minOpacity: 0.1,
                        maxOpacity: 0.8,
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

                  const fixedSeed = next.fillOpacityAttr.enabled
                    ? next.fillOpacityAttr.maxOpacity
                    : next.fillOpacityAttr.fixed.opacity;

                  next.fillOpacityAttr = {
                    enabled: false,
                    fixed: { opacity: clamp01(fixedSeed ?? 0.8) },
                  };

                  return next;
                })
              }
              aria-label="Usar variable para opacidad"
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
              disabled={!fillEnabled}
              value={opacityAttr.fixed.opacity}
              onChange={(e) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.fillOpacityAttr.enabled) {
                    next.fillOpacityAttr.fixed.opacity = clamp01(
                      parseNum(
                        e.target.value,
                        next.fillOpacityAttr.fixed.opacity,
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
                disabled={!fillEnabled || !hasVars}
                value={
                  hasVars ? (opacityAttr.variable ?? elipseVariables[0]) : ""
                }
                onChange={(e) =>
                  update((s) => {
                    const next = structuredClone(s);
                    if (next.fillOpacityAttr.enabled)
                      next.fillOpacityAttr.variable = e.target.value;
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
                  disabled={!fillEnabled}
                  value={opacityAttr.minOpacity}
                  onChange={(e) =>
                    update((s) => {
                      const next = structuredClone(s);
                      if (next.fillOpacityAttr.enabled) {
                        next.fillOpacityAttr.minOpacity = clamp01(
                          parseNum(
                            e.target.value,
                            next.fillOpacityAttr.minOpacity,
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
                  disabled={!fillEnabled}
                  value={opacityAttr.maxOpacity}
                  onChange={(e) =>
                    update((s) => {
                      const next = structuredClone(s);
                      if (next.fillOpacityAttr.enabled) {
                        next.fillOpacityAttr.maxOpacity = clamp01(
                          parseNum(
                            e.target.value,
                            next.fillOpacityAttr.maxOpacity,
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
              disabledAll={!fillEnabled}
              mode={opacityAttr.range.min.mode}
              scope={coerceScope(opacityAttr.range.min.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.fillOpacityAttr.enabled) return next;

                  const ep = next.fillOpacityAttr.range.min;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = fillNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      fillOpacityVar,
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
              variable={fillOpacityVar}
              normByScope={fillNormByScope}
              manualValue={opacityAttr.range.min.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.fillOpacityAttr.enabled) {
                    next.fillOpacityAttr.range.min.manual = parseNum(
                      raw,
                      next.fillOpacityAttr.range.min.manual,
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
              disabledAll={!fillEnabled}
              mode={opacityAttr.range.max.mode}
              scope={coerceScope(opacityAttr.range.max.scope)}
              onChangeMode={(m) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (!next.fillOpacityAttr.enabled) return next;

                  const ep = next.fillOpacityAttr.range.max;

                  if (m === "manual") {
                    const sc = coerceScope(ep.scope);
                    const ranges = fillNormByScope[sc]?.ranges ?? {};
                    const auto = getAutoRangeForVariable(
                      ranges,
                      fillOpacityVar,
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
              variable={fillOpacityVar}
              normByScope={fillNormByScope}
              manualValue={opacityAttr.range.max.manual}
              onChangeManual={(raw) =>
                update((s) => {
                  const next = structuredClone(s);
                  if (next.fillOpacityAttr.enabled) {
                    next.fillOpacityAttr.range.max.manual = parseNum(
                      raw,
                      next.fillOpacityAttr.range.max.manual,
                    );
                  }
                  return next;
                })
              }
              lastAuto={opacityAttr.range.max.lastAuto}
              which="max"
            />

            {fillOpacityInvalid && (
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
