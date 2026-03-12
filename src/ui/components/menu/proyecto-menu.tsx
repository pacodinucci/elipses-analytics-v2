// src/components/menu/proyecto-menu.tsx
import "./proyecto-menu.css";

type ProyectoMenuProps = {
  onAbrirProyecto: () => void;
  onOpenImportar: () => void;
  onOpenUnidades: () => void;
  canConfigureUnidades: boolean;

  isOpen: boolean;
  isAnyOpen: boolean;
  onClickTitle: () => void;
  onHoverTitle: () => void;
  onRequestClose: () => void;
};

export function ProyectoMenu({
  onAbrirProyecto,
  onOpenImportar,
  onOpenUnidades,
  canConfigureUnidades,
  isOpen,
  onClickTitle,
  onHoverTitle,
  onRequestClose,
}: ProyectoMenuProps) {
  const handle = (fn: () => void) => {
    fn();
    onRequestClose();
  };

  return (
    <div className="proyectoMenu">
      <div
        className="proyectoMenu__title"
        onClick={onClickTitle}
        onMouseEnter={onHoverTitle}
      >
        Proyecto
      </div>

      {isOpen && (
        <div className="proyectoMenu__dropdown">
          <MenuItem
            label="Crear proyecto"
            onClick={() => handle(() => console.log("Crear proyecto"))}
          />

          <MenuItem
            label="Abrir proyecto"
            onClick={() => handle(onAbrirProyecto)}
          />

          <Separator />

          <MenuItem
            label="Seleccionar yacimiento"
            onClick={() => handle(() => console.log("Seleccionar yacimiento"))}
          />

          <MenuItem
            label="Crear nuevo yacimiento"
            onClick={() => handle(() => console.log("Crear nuevo yacimiento"))}
          />

          <Separator />

          <MenuItem
            label="Cargar capas"
            onClick={() => handle(() => console.log("Cargar capas"))}
          />

          <MenuItem
            label="Cargar pozos"
            onClick={() => handle(() => console.log("Cargar pozos"))}
          />

          <Separator />

          <MenuItem label="Importar" onClick={() => handle(onOpenImportar)} />

          <div className="proyectoMenu__submenuTrigger">
            <span>{"Configuraci\u00f3n"}</span>
            <span className="proyectoMenu__submenuChevron">{">"}</span>

            <div className="proyectoMenu__submenu">
              <MenuItem
                label="Unidades"
                onClick={() => handle(onOpenUnidades)}
                disabled={!canConfigureUnidades}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={["proyectoMenu__item", disabled ? "is-disabled" : ""].join(" ")}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
    >
      {label}
    </div>
  );
}

function Separator() {
  return <div className="proyectoMenu__separator" />;
}
