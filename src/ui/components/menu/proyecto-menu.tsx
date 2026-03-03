// src/components/menu/proyecto-menu.tsx
import "./proyecto-menu.css";

type ProyectoMenuProps = {
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
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="proyectoMenu__item" onClick={onClick}>
      {label}
    </div>
  );
}

function Separator() {
  return <div className="proyectoMenu__separator" />;
}
