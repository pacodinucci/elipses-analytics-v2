// src/components/mapa/date-timeline.tsx
import { useMemo } from "react";
import "./date-timeline.css";

type Option = {
  value: string; // "YYYY-MM-01"
  label: string; // "1/MM/YYYY"
};

type Props = {
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
};

function isSame(a: string, b: string) {
  return a === b;
}

export function DateTimeline({ options, value, onChange }: Props) {
  const count = Math.max(options.length, 1);

  const activeIndex = useMemo(() => {
    if (!value) return -1;
    return options.findIndex((o) => isSame(o.value, value));
  }, [options, value]);

  // 0..1 (posición relativa del cursor)
  const activeT = useMemo(() => {
    if (activeIndex < 0 || count <= 1) return 0;
    return activeIndex / (count - 1);
  }, [activeIndex, count]);

  return (
    <div className="timeline">
      <div className="timeline__track">
        {/* Línea base */}
        <div className="timeline__line" />

        {/* Cursor tipo dial (solo si hay selección válida) */}
        {activeIndex >= 0 && (
          <div
            className="timeline__cursor"
            style={{ left: `${activeT * 100}%` }}
            aria-hidden="true"
          >
            <div className="timeline__cursorCap" />
            <div className="timeline__cursorNeedle" />
          </div>
        )}

        {/* Grid con ticks clickeables */}
        <div
          className="timeline__grid"
          style={{
            gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
          }}
        >
          {options.map((o) => {
            const active = value != null && isSame(o.value, value);

            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className="timeline__btn"
                aria-pressed={active}
                title={o.label}
              >
                <span
                  className={[
                    "timeline__tick",
                    active ? "is-active" : "is-idle",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
