// src/components/menu/menu-bar.tsx
import { useState } from "react";
import { ProyectoMenu } from "./proyecto-menu";
import { VerMenu } from "./ver-menu";

import "./menu-bar.css";

type CapasBarPosition = "top" | "left";

type MenuBarProps = {
  onAbrirProyecto: () => void;
  onOpenImportar: () => void;

  showWindowMapa: boolean;
  showWindowTabla: boolean;
  showWindowDatosMapa: boolean;

  showCapasBar: boolean;

  capasBarPosition: CapasBarPosition;
  onChangeCapasBarPosition: (pos: CapasBarPosition) => void;

  onToggleMapaWindow: () => void;
  onToggleTablaWindow: () => void;
  onToggleDatosMapaWindow: () => void;

  onToggleCapasBar: () => void;
};

export function MenuBar({
  onAbrirProyecto,
  onOpenImportar,

  showWindowMapa,
  showWindowTabla,
  showWindowDatosMapa,

  showCapasBar,

  capasBarPosition,
  onChangeCapasBarPosition,

  onToggleMapaWindow,
  onToggleTablaWindow,
  onToggleDatosMapaWindow,

  onToggleCapasBar,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<"proyecto" | "ver" | null>(null);

  const isAnyOpen = openMenu !== null;

  return (
    <div className="menuBar" onMouseLeave={() => setOpenMenu(null)}>
      <ProyectoMenu
        onAbrirProyecto={onAbrirProyecto}
        onOpenImportar={onOpenImportar}
        isOpen={openMenu === "proyecto"}
        isAnyOpen={isAnyOpen}
        onClickTitle={() =>
          setOpenMenu((prev) => (prev === "proyecto" ? null : "proyecto"))
        }
        onHoverTitle={() => {
          if (isAnyOpen && openMenu !== "proyecto") setOpenMenu("proyecto");
        }}
        onRequestClose={() => setOpenMenu(null)}
      />

      <VerMenu
        isOpen={openMenu === "ver"}
        isAnyOpen={isAnyOpen}
        onClickTitle={() =>
          setOpenMenu((prev) => (prev === "ver" ? null : "ver"))
        }
        onHoverTitle={() => {
          if (isAnyOpen && openMenu !== "ver") setOpenMenu("ver");
        }}
        onRequestClose={() => setOpenMenu(null)}
        showWindowMapa={showWindowMapa}
        showWindowTabla={showWindowTabla}
        showWindowDatosMapa={showWindowDatosMapa}
        showCapasBar={showCapasBar}
        capasBarPosition={capasBarPosition}
        onChangeCapasBarPosition={onChangeCapasBarPosition}
        onToggleMapaWindow={onToggleMapaWindow}
        onToggleTablaWindow={onToggleTablaWindow}
        onToggleDatosMapaWindow={onToggleDatosMapaWindow}
        onToggleCapasBar={onToggleCapasBar}
      />
    </div>
  );
}
