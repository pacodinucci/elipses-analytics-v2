// src/components/menu/ver-menu.tsx
import "./ver-menu.css";

type CapasBarPosition = "top" | "left";

type Props = {
  isOpen: boolean;
  isAnyOpen: boolean;

  onClickTitle: () => void;
  onHoverTitle: () => void;
  onRequestClose: () => void;

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

function CheckItem({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="menuDropdown__item" onClick={onClick}>
      <span
        className={["menuDropdown__check", checked ? "is-on" : ""].join(" ")}
      >
        {checked ? "✓" : ""}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function VerMenu({
  isOpen,
  onClickTitle,
  onHoverTitle,
  onRequestClose,

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
}: Props) {
  return (
    <div className="menuBarItem" onMouseEnter={onHoverTitle}>
      <button
        type="button"
        className={["menuBarItem__title", isOpen ? "is-open" : ""].join(" ")}
        onClick={onClickTitle}
      >
        Ver
      </button>

      {isOpen ? (
        <div className="menuDropdown">
          <div className="menuDropdown__sectionTitle">Ventanas</div>

          <CheckItem
            label="Mapa"
            checked={showWindowMapa}
            onClick={() => {
              onToggleMapaWindow();
              onRequestClose();
            }}
          />

          <CheckItem
            label="Producción"
            checked={showWindowTabla}
            onClick={() => {
              onToggleTablaWindow();
              onRequestClose();
            }}
          />

          <CheckItem
            label="Datos mapa"
            checked={showWindowDatosMapa}
            onClick={() => {
              onToggleDatosMapaWindow();
              onRequestClose();
            }}
          />

          <div className="menuDropdown__divider" />

          <div className="menuDropdown__sectionTitle">Capas</div>

          <CheckItem
            label="Barra de capas"
            checked={showCapasBar}
            onClick={() => {
              onToggleCapasBar();
              onRequestClose();
            }}
          />

          <div className="menuDropdown__subRow">
            <span className="menuDropdown__muted">Posición</span>
            <div className="menuDropdown__pillGroup">
              <button
                type="button"
                className={[
                  "menuDropdown__pill",
                  capasBarPosition === "top" ? "is-active" : "",
                ].join(" ")}
                onClick={() => {
                  onChangeCapasBarPosition("top");
                  onRequestClose();
                }}
              >
                Arriba
              </button>

              <button
                type="button"
                className={[
                  "menuDropdown__pill",
                  capasBarPosition === "left" ? "is-active" : "",
                ].join(" ")}
                onClick={() => {
                  onChangeCapasBarPosition("left");
                  onRequestClose();
                }}
              >
                Izquierda
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
