// src/components/menu/ver-menu.tsx
import "./ver-menu.css";

type CapasBarPosition = "top" | "left";

type VerMenuProps = {
  isOpen: boolean;
  isAnyOpen: boolean;
  onClickTitle: () => void;
  onHoverTitle: () => void;
  onRequestClose: () => void;

  showWindowMapa: boolean;
  showWindowTabla: boolean;
  showWindowDatosMapa: boolean;

  showCapasBar: boolean;

  // ✅ NUEVO: posición barra de capas
  capasBarPosition: CapasBarPosition;
  onChangeCapasBarPosition: (pos: CapasBarPosition) => void;

  onToggleMapaWindow: () => void;
  onToggleTablaWindow: () => void;
  onToggleDatosMapaWindow: () => void;

  onToggleCapasBar: () => void;
};

export function VerMenu({
  isOpen,
  onClickTitle,
  onHoverTitle,

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
}: VerMenuProps) {
  return (
    <div className="verMenu">
      <div
        className="verMenu__title"
        onClick={onClickTitle}
        onMouseEnter={onHoverTitle}
      >
        Ver
      </div>

      {isOpen && (
        <div className="verMenu__dropdown">
          <CheckMenuItem
            label="Ventana de mapa"
            checked={showWindowMapa}
            onClick={onToggleMapaWindow}
          />

          <CheckMenuItem
            label="Ventana de producción"
            checked={showWindowTabla}
            onClick={onToggleTablaWindow}
          />

          <CheckMenuItem
            label="Datos del mapa"
            checked={showWindowDatosMapa}
            onClick={onToggleDatosMapaWindow}
          />

          <CheckMenuItem
            label="Barra de capas"
            checked={showCapasBar}
            onClick={onToggleCapasBar}
          />

          {/* ✅ Posición de la barra de capas */}
          <div
            className={`verMenu__group ${!showCapasBar ? "is-disabled" : ""}`}
          >
            <div className="verMenu__groupTitle">
              Posición de barra de capas
            </div>

            <RadioMenuItem
              label="Superior"
              checked={capasBarPosition === "top"}
              disabled={!showCapasBar}
              onClick={() => onChangeCapasBarPosition("top")}
            />

            <RadioMenuItem
              label="Izquierda"
              checked={capasBarPosition === "left"}
              disabled={!showCapasBar}
              onClick={() => onChangeCapasBarPosition("left")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CheckMenuItem({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <div className="verMenu__item" onClick={onClick}>
      <span className="verMenu__check">{checked ? "✓" : ""}</span>
      <span className="verMenu__label">{label}</span>
    </div>
  );
}

function RadioMenuItem({
  label,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`verMenu__item ${disabled ? "is-disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
    >
      <span className="verMenu__check">{checked ? "●" : "○"}</span>
      <span className="verMenu__label">{label}</span>
    </div>
  );
}
