// src/components/mapa/elipses-options-tabs-modal.tsx
import { useMemo, useState } from "react";
import { GrFilter } from "react-icons/gr";
import type {
  ElipsesNormalizationScope,
  ElipsesStyle,
} from "../../store/elipses-style";
import { OptionsShellModal, type OptionsNavItem } from "./options-shell-modal";

import { IconAxis, IconContour, IconFill } from "./elipses-options/shared";

import { FillTab } from "./elipses-options/fill/fill-tab";
import { ContourTab } from "./elipses-options/contour/contour-tab";
import { AxisTab } from "./elipses-options/axis/axis-tab";

// ✅ tab de filtros (UI first)
import { FiltersTab } from "./elipses-options/filters/filters-tab";

import { useFillTab } from "./elipses-options/fill/use-fill-tab";
import { useAxisTab } from "./elipses-options/axis/use-axis-tab";
import { useContourTab } from "./elipses-options/contour/use-contour-tab";

import "./elipses-options-tabs-modal.css";

type TabKey = "fill" | "contour" | "axis" | "filters";

export type ElipsesOptionsTabsModalProps = {
  isOpen: boolean;
  onClose: () => void;

  elipseVariables: string[];

  // legacy props mantenidos por compat con parent (pero no usados acá)
  fillVariable: string | null;
  onChangeFillVariable: (value: string | null) => void;

  fillColorVariable: string | null;
  onChangeFillColorVariable: (value: string | null) => void;

  contourLinkChannels: boolean;
  contourOpacityVariable: string | null;
  contourWidthVariable: string | null;
  contourColorVariable: string | null;

  onChangeContourLinkChannels: (value: boolean) => void;
  onChangeContourOpacityVariable: (value: string | null) => void;
  onChangeContourWidthVariable: (value: string | null) => void;
  onChangeContourColorVariable: (value: string | null) => void;

  axisLinkChannels: boolean;
  axisOpacityVariable: string | null;
  axisWidthVariable: string | null;
  axisColorVariable: string | null;

  onChangeAxisLinkChannels: (value: boolean) => void;
  onChangeAxisOpacityVariable: (value: string | null) => void;
  onChangeAxisWidthVariable: (value: string | null) => void;
  onChangeAxisColorVariable: (value: string | null) => void;

  style: ElipsesStyle;
  onChangeStyle: (style: ElipsesStyle) => void;

  fillNormalizationScope: ElipsesNormalizationScope;
  contourNormalizationScope: ElipsesNormalizationScope;
  axisNormalizationScope: ElipsesNormalizationScope;

  onChangeFillNormalizationScope: (v: ElipsesNormalizationScope) => void;
  onChangeContourNormalizationScope: (v: ElipsesNormalizationScope) => void;
  onChangeAxisNormalizationScope: (v: ElipsesNormalizationScope) => void;

  // ✅ v2 context
  proyectoId: string | null;
  simulacionId: string | null;

  // mantenemos nombre por compat UI (si después migrás a capaId, lo cambiamos)
  capaNombre: string | null;
  fecha: string | null; // YYYY-MM-DD
};

export function ElipsesOptionsTabsModal({
  isOpen,
  onClose,
  elipseVariables,

  style,
  onChangeStyle,

  proyectoId,
  simulacionId,
  capaNombre,
  fecha,
}: ElipsesOptionsTabsModalProps) {
  const [tab, setTab] = useState<TabKey>("fill");
  const hasVars = elipseVariables.length > 0;

  const tabTitle = useMemo(() => {
    switch (tab) {
      case "fill":
        return "Relleno";
      case "contour":
        return "Contorno";
      case "axis":
        return "Eje (polo a polo)";
      case "filters":
        return "Filtros";
      default:
        return "Opciones";
    }
  }, [tab]);

  const items: OptionsNavItem<TabKey>[] = useMemo(
    () => [
      {
        key: "fill",
        title: "Relleno",
        subtitle: "Color, escala y opacidad",
        icon: <IconFill />,
      },
      {
        key: "contour",
        title: "Contorno",
        subtitle: "Color, opacidad y grosor",
        icon: <IconContour />,
      },
      {
        key: "axis",
        title: "Eje (polo a polo)",
        subtitle: "Mostrar + parámetros",
        icon: <IconAxis />,
      },
      {
        key: "filters",
        title: "Filtros",
        subtitle: "Históricas + reglas",
        icon: (
          <span>
            <GrFilter size={18} />
          </span>
        ),
      },
    ],
    [],
  );

  // ✅ FILL hook (v2)
  const fill = useFillTab({
    tabActive: tab === "fill",
    elipseVariables,
    style,
    onChangeStyle,
    proyectoId,
    simulacionId,
    capaNombre,
    fecha,
  });

  // ✅ AXIS hook (v2)
  const axis = useAxisTab({
    tabActive: tab === "axis",
    elipseVariables,
    style,
    onChangeStyle,
    proyectoId,
    simulacionId,
    capaNombre,
    fecha,
  });

  // ✅ CONTOUR hook (v2)
  const contour = useContourTab({
    tabActive: tab === "contour",
    elipseVariables,
    style,
    onChangeStyle,
    proyectoId,
    simulacionId,
    capaNombre,
    fecha,
  });

  return (
    <OptionsShellModal<TabKey>
      isOpen={isOpen}
      onClose={onClose}
      title="Opciones de elipses"
      items={items}
      activeKey={tab}
      onChangeKey={setTab}
      panelTitle={tabTitle}
      widthClassName="elipsesOpt__w"
      heightClassName="elipsesOpt__h"
      sidebarWidthClassName="elipsesOpt__grid"
    >
      {!hasVars ? (
        <p className="elipsesOpt__empty">
          No hay variables de elipses disponibles.
        </p>
      ) : (
        <>
          {tab === "fill" && (
            <FillTab
              elipseVariables={elipseVariables}
              style={style}
              onChangeStyle={onChangeStyle}
              fillEnabled={fill.fillEnabled}
              fillNormByScope={fill.fillNormByScope}
              proyectoId={proyectoId}
              simulacionId={simulacionId}
              capaNombre={capaNombre}
              fecha={fecha}
            />
          )}

          {tab === "contour" && (
            <ContourTab
              elipseVariables={elipseVariables}
              style={style}
              onChangeStyle={onChangeStyle}
              contourEnabled={contour.contourEnabled}
              contourNormByScope={contour.contourNormByScope}
              proyectoId={proyectoId}
              simulacionId={simulacionId}
              capaNombre={capaNombre}
              fecha={fecha}
            />
          )}

          {tab === "axis" && (
            <AxisTab
              elipseVariables={elipseVariables}
              style={style}
              onChangeStyle={onChangeStyle}
              axisEnabled={axis.axisEnabled}
              axisNormByScope={axis.axisNormByScope}
              proyectoId={proyectoId}
              simulacionId={simulacionId}
              capaNombre={capaNombre}
              fecha={fecha}
            />
          )}

          {tab === "filters" && (
            <FiltersTab elipseVariables={elipseVariables} />
          )}
        </>
      )}
    </OptionsShellModal>
  );
}
