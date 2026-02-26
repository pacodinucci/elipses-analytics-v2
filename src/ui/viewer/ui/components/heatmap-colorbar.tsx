// src/viewer/ui/components/heatmap-colorbar.tsx
import type { HeatmapStyle } from "../../../store/heatmap-style";
import "./heatmap-colorbar.css";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function parseDotFormat(fmt: string): number | null {
  // soporta ".2f" ".0f" etc
  const m = fmt.trim().match(/^\.(\d+)f$/);
  if (!m) return null;
  const d = Number(m[1]);
  return Number.isFinite(d) ? d : null;
}

function formatWithTickFormat(v: number, tickFormat: string): string {
  const decimals = parseDotFormat(tickFormat);
  if (decimals == null) {
    // fallback razonable
    const abs = Math.abs(v);
    if (abs !== 0 && (abs < 0.001 || abs >= 1e6)) return v.toExponential(2);
    if (abs < 10) return v.toFixed(2);
    if (abs < 1000) return v.toFixed(1);
    return Math.round(v).toString();
  }
  return v.toFixed(decimals);
}

function gradientFromCustomStops(stops: HeatmapStyle["customStops"]): string {
  // stops.value están en escala absoluta (min..max). Normalizamos a % en base al min/max provistos.
  // Ojo: el componente recibe min/max del dataset; si stops no cubren ese rango, igual funciona.
  if (!Array.isArray(stops) || stops.length < 2) {
    return "linear-gradient(to top, #440154 0%, #3b528b 25%, #21918c 50%, #5ec962 75%, #fde725 100%)";
  }

  // Ordenar por value
  const sorted = [...stops].sort((a, b) => a.value - b.value);

  const minV = sorted[0].value;
  const maxV = sorted[sorted.length - 1].value;
  const span = maxV - minV || 1;

  const parts = sorted.map((s) => {
    const t = clamp01((s.value - minV) / span);
    const pct = t * 100;
    return `${s.color} ${pct.toFixed(2)}%`;
  });

  return `linear-gradient(to top, ${parts.join(", ")})`;
}

type Props = {
  heatmapStyle: HeatmapStyle;
  min: number;
  max: number;
  title?: string;
  className?: string;
};

export function HeatmapColorbar({
  heatmapStyle,
  min,
  max,
  title,
  className,
}: Props) {
  // Respeta el flag del store
  if (!heatmapStyle.showScale) return null;

  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : 1;
  const span = safeMax - safeMin;

  const tickCount = Math.max(2, Math.floor(heatmapStyle.tickCount ?? 6));
  const tickValues: number[] = [];

  if (!Number.isFinite(span) || span === 0) {
    tickValues.push(safeMin, safeMax);
  } else {
    for (let i = 0; i < tickCount; i++) {
      const t = i / (tickCount - 1);
      tickValues.push(lerp(safeMin, safeMax, t));
    }
  }

  const thickness = Math.max(
    10,
    Math.floor(heatmapStyle.colorbarThickness ?? 20),
  );
  const gradient = gradientFromCustomStops(heatmapStyle.customStops);

  // Si el fillMode es "opacity", mostramos una barra monocromática con alpha (opcional)
  const barBackground =
    heatmapStyle.fillMode === "opacity"
      ? `linear-gradient(to top, rgba(68,1,84, ${clamp01(heatmapStyle.opacityMin)}), rgba(68,1,84, ${clamp01(
          heatmapStyle.opacityMax,
        )}))`
      : gradient;

  return (
    <div className={`heatmapColorbar ${className ?? ""}`}>
      {title ? <div className="heatmapColorbar__title">{title}</div> : null}

      <div className="heatmapColorbar__body">
        <div
          className="heatmapColorbar__bar"
          style={{ width: thickness, background: barBackground }}
        />

        <div className="heatmapColorbar__ticks" style={{ height: 220 }}>
          {tickValues
            .slice()
            .reverse()
            .map((v, idx) => (
              <div key={`${v}-${idx}`} className="heatmapColorbar__tickRow">
                <span className="heatmapColorbar__tickLine" />
                <span className="heatmapColorbar__tickLabel">
                  {formatWithTickFormat(v, heatmapStyle.tickFormat)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
