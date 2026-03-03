// src/components/mapa/elipses-references.tsx
import "./elipses-references.css";
import { useElipsesStyle } from "../../store/elipses-style";

type Props = {
  visible: boolean;
};

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="elipsesRef__row">
      <span className="elipsesRef__label">{label}</span>
      <span className="elipsesRef__value" title={value}>
        {value}
      </span>
    </div>
  );
}

export function ElipsesReferences({ visible }: Props) {
  const style = useElipsesStyle((s) => s.elipsesStyle);

  if (!visible) return null;

  // ✅ Fuente de verdad: attrs del modelo nuevo
  const fillOpacityVar =
    style.fillOpacityAttr?.enabled && style.fillOpacityAttr.variable
      ? style.fillOpacityAttr.variable
      : null;

  const fillColorVar =
    style.fillColorAttr?.enabled && style.fillColorAttr.variable
      ? style.fillColorAttr.variable
      : null;

  const axisOpacityVar =
    style.axisOpacityAttr?.enabled && style.axisOpacityAttr.variable
      ? style.axisOpacityAttr.variable
      : null;

  const axisWidthVar =
    style.axisWidthAttr?.enabled && style.axisWidthAttr.variable
      ? style.axisWidthAttr.variable
      : null;

  const axisColorVar =
    style.axisColorAttr?.enabled && style.axisColorAttr.variable
      ? style.axisColorAttr.variable
      : null;

  const contourOpacityVar =
    style.contourOpacityAttr?.enabled && style.contourOpacityAttr.variable
      ? style.contourOpacityAttr.variable
      : null;

  const contourWidthVar =
    style.contourWidthAttr?.enabled && style.contourWidthAttr.variable
      ? style.contourWidthAttr.variable
      : null;

  const contourColorVar =
    style.contourColorAttr?.enabled && style.contourColorAttr.variable
      ? style.contourColorAttr.variable
      : null;

  return (
    <div className="elipsesRef">
      <div className="elipsesRef__title">Elipses</div>

      <div className="elipsesRef__list">
        {/* FILL */}
        {style.fillEnabled && (
          <>
            <Row label="Relleno (opacidad)" value={fillOpacityVar} />
            <Row label="Relleno (colores)" value={fillColorVar} />
          </>
        )}

        {/* AXIS */}
        {style.axisEnabled && (
          <>
            <Row label="Eje (opacidad)" value={axisOpacityVar} />
            <Row label="Eje (grosor)" value={axisWidthVar} />
            <Row label="Eje (colores)" value={axisColorVar} />
          </>
        )}

        {/* CONTOUR */}
        {style.contourEnabled && (
          <>
            <Row label="Contorno (opacidad)" value={contourOpacityVar} />
            <Row label="Contorno (grosor)" value={contourWidthVar} />
            <Row label="Contorno (colores)" value={contourColorVar} />
          </>
        )}
      </div>
    </div>
  );
}
