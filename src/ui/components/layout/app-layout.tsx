// src/components/layout/app-layout.tsx
import type { PropsWithChildren } from "react";

import { MenuBar } from "../menu/menu-bar";
import { BreadcrumbBar } from "./breadcrumb-bar";

import "./app-layout.css";

type CapasBarPosition = "top" | "left";

type AppLayoutProps = PropsWithChildren<{
  onAbrirProyecto: () => void;
  onOpenImportar: () => void;

  selectedProyecto: Proyecto | null;

  onToggleMapaWindow: () => void;
  onToggleProduccionWindow: () => void;
  onToggleDatosMapaWindow: () => void;

  isMapaWindowOpen: boolean;
  isProduccionWindowOpen: boolean;
  isDatosMapaWindowOpen: boolean;

  isCapasBarOpen: boolean;
  onToggleCapasBar: () => void;

  capasBarPosition: CapasBarPosition;
  onChangeCapasBarPosition: (pos: CapasBarPosition) => void;
}>;

export default function AppLayout({
  children,
  onAbrirProyecto,
  onOpenImportar,

  selectedProyecto,

  onToggleMapaWindow,
  onToggleProduccionWindow,
  onToggleDatosMapaWindow,

  isMapaWindowOpen,
  isProduccionWindowOpen,
  isDatosMapaWindowOpen,

  isCapasBarOpen,
  onToggleCapasBar,

  capasBarPosition,
  onChangeCapasBarPosition,
}: AppLayoutProps) {
  return (
    <div className="appLayout">
      <MenuBar
        onAbrirProyecto={onAbrirProyecto}
        onOpenImportar={onOpenImportar}
        showWindowMapa={isMapaWindowOpen}
        showWindowTabla={isProduccionWindowOpen}
        showWindowDatosMapa={isDatosMapaWindowOpen}
        onToggleMapaWindow={onToggleMapaWindow}
        onToggleTablaWindow={onToggleProduccionWindow}
        onToggleDatosMapaWindow={onToggleDatosMapaWindow}
        showCapasBar={isCapasBarOpen}
        onToggleCapasBar={onToggleCapasBar}
        capasBarPosition={capasBarPosition}
        onChangeCapasBarPosition={onChangeCapasBarPosition}
      />

      <BreadcrumbBar selectedProyecto={selectedProyecto} />

      <main className="appLayout__content">{children}</main>
    </div>
  );
}
