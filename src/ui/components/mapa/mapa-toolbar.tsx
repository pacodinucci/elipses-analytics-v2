// src/components/mapa/mapa-toolbar.tsx
import * as React from "react";
import { FaOilWell } from "react-icons/fa6";
import {
  TbLayoutSidebarLeftExpand,
  TbChartCovariate,
  TbBrandStorytel,
  TbListDetails,
  TbEye,
  TbEyeOff,
  TbBubble,
} from "react-icons/tb";

import { ToolbarButton } from "./toolbar-button";
import "./mapa-toolbar.css";

type Props = {
  // Navegador
  showNavigator: boolean;
  toggleNavigator: () => void;

  // Toggles de capas
  showMapa: boolean;
  toggleMapa: () => void;

  showPozos: boolean;
  togglePozos: () => void;

  showElipses: boolean;
  toggleElipses: () => void;

  // Bubbles
  showBubbles: boolean;
  toggleBubbles: () => void;

  // Disponibilidad / datos
  hasMapa: boolean;
  pozos?: { length: number } | null;
  elipses?: { length: number } | null;
  bubbles?: { length: number } | null;

  // Referencias elipses
  showElipsesReferences: boolean;
  toggleElipsesReferences: () => void;

  // Modales
  onOpenMapaOptions: () => void;
  onOpenPozoOptions: () => void;
  onOpenElipsesOptions: () => void;
  onOpenBubblesOptions: () => void;

  className?: string;
};

function EyeIcon({ on }: { on: boolean }) {
  return on ? <TbEye size={16} /> : <TbEyeOff size={16} />;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mapaToolbar__groupLabel">{children}</div>;
}

export function MapaToolbar({
  showNavigator,
  toggleNavigator,

  showMapa,
  toggleMapa,
  showPozos,
  togglePozos,
  showElipses,
  toggleElipses,

  showBubbles,
  toggleBubbles,

  hasMapa,
  pozos,
  elipses,
  bubbles,

  showElipsesReferences,
  toggleElipsesReferences,

  onOpenMapaOptions,
  onOpenPozoOptions,
  onOpenElipsesOptions,
  onOpenBubblesOptions,

  className,
}: Props) {
  const hasPozosData = (pozos?.length ?? 0) > 0;
  const hasElipsesData = (elipses?.length ?? 0) > 0;
  const hasBubblesData = (bubbles?.length ?? 0) > 0;

  // Reglas de habilitación
  const canToggleMapa = hasMapa;
  const canTogglePozos = hasPozosData;
  const canToggleElipses = hasElipsesData;
  const canToggleBubbles = hasBubblesData;

  return (
    <div className={["mapaToolbar", className ?? ""].join(" ").trim()}>
      {/* Grupo: Navegación */}
      <div className="mapaToolbar__groupWrap" aria-label="Navegación">
        <GroupLabel>Nav</GroupLabel>
        <div className="mapaToolbar__group">
          <ToolbarButton
            title="Navegador"
            active={showNavigator}
            onClick={toggleNavigator}
          >
            <TbLayoutSidebarLeftExpand size={16} />
          </ToolbarButton>
        </div>
      </div>

      <div className="mapaToolbar__sep" />

      {/* Grupo: Mapa */}
      <div className="mapaToolbar__groupWrap" aria-label="Mapa">
        <GroupLabel>Mapa</GroupLabel>
        <div className="mapaToolbar__group">
          <ToolbarButton
            title={showMapa ? "Ocultar mapa" : "Mostrar mapa"}
            active={showMapa}
            onClick={toggleMapa}
            disabled={!canToggleMapa}
          >
            <EyeIcon on={showMapa} />
          </ToolbarButton>

          <ToolbarButton
            title="Opciones de mapa"
            active={hasMapa}
            onClick={onOpenMapaOptions}
            disabled={!hasMapa}
          >
            <TbChartCovariate size={16} />
          </ToolbarButton>
        </div>
      </div>

      <div className="mapaToolbar__sep" />

      {/* Grupo: Pozos */}
      <div className="mapaToolbar__groupWrap" aria-label="Pozos">
        <GroupLabel>Pozos</GroupLabel>
        <div className="mapaToolbar__group">
          <ToolbarButton
            title={showPozos ? "Ocultar pozos" : "Mostrar pozos"}
            active={showPozos}
            onClick={togglePozos}
            disabled={!canTogglePozos}
          >
            <EyeIcon on={showPozos} />
          </ToolbarButton>

          <ToolbarButton
            title="Opciones de pozos"
            active={showPozos}
            onClick={onOpenPozoOptions}
            disabled={!hasPozosData}
          >
            <FaOilWell size={16} />
          </ToolbarButton>
        </div>
      </div>

      <div className="mapaToolbar__sep" />

      {/* Grupo: Burbujas */}
      <div className="mapaToolbar__groupWrap" aria-label="Burbujas">
        <GroupLabel>Burbujas</GroupLabel>
        <div className="mapaToolbar__group">
          <ToolbarButton
            title={showBubbles ? "Ocultar burbujas" : "Mostrar burbujas"}
            active={showBubbles}
            onClick={toggleBubbles}
            disabled={!canToggleBubbles}
          >
            <EyeIcon on={showBubbles} />
          </ToolbarButton>

          <ToolbarButton
            title="Opciones de burbujas"
            active={showBubbles}
            onClick={onOpenBubblesOptions}
            disabled={!hasBubblesData}
          >
            <TbBubble size={16} />
          </ToolbarButton>
        </div>
      </div>

      <div className="mapaToolbar__sep" />

      {/* Grupo: Elipses */}
      <div className="mapaToolbar__groupWrap" aria-label="Elipses">
        <GroupLabel>Elipses</GroupLabel>
        <div className="mapaToolbar__group">
          <ToolbarButton
            title={showElipses ? "Ocultar elipses" : "Mostrar elipses"}
            active={showElipses}
            onClick={toggleElipses}
            disabled={!canToggleElipses}
          >
            <EyeIcon on={showElipses} />
          </ToolbarButton>

          <ToolbarButton
            title="Opciones de elipses"
            active={showElipses}
            onClick={onOpenElipsesOptions}
            disabled={!hasElipsesData}
          >
            <TbBrandStorytel size={16} />
          </ToolbarButton>

          <ToolbarButton
            title="Referencias de elipses"
            active={showElipsesReferences}
            onClick={toggleElipsesReferences}
            disabled={!hasElipsesData || !showElipses}
          >
            <TbListDetails size={16} />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
}
