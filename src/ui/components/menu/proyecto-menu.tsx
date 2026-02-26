// src/components/menu/proyecto-menu.tsx
import "./proyecto-menu.css";

type Props = {
  onAbrirProyecto: () => void;
  onOpenImportar: () => void;

  isOpen: boolean;
  isAnyOpen: boolean;

  onClickTitle: () => void;
  onHoverTitle: () => void;

  onRequestClose: () => void;
};

export function ProyectoMenu({
  onAbrirProyecto,
  onOpenImportar,
  isOpen,
  isAnyOpen,
  onClickTitle,
  onHoverTitle,
  onRequestClose,
}: Props) {
  return (
    <div className="menuBarItem" onMouseEnter={onHoverTitle}>
      <button
        type="button"
        className={["menuBarItem__title", isOpen ? "is-open" : ""].join(" ")}
        onClick={onClickTitle}
      >
        Proyecto
      </button>

      {isOpen ? (
        <div className="menuDropdown" onMouseLeave={() => isAnyOpen && null}>
          <button
            type="button"
            className="menuDropdown__item"
            onClick={() => {
              onAbrirProyecto();
              onRequestClose();
            }}
          >
            Abrir proyecto…
          </button>

          <button
            type="button"
            className="menuDropdown__item"
            onClick={() => {
              onOpenImportar();
              onRequestClose();
            }}
          >
            Importar…
          </button>
        </div>
      ) : null}
    </div>
  );
}
