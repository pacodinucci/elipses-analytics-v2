// src/components/project/select-project-modal.tsx
import "./select-project-modal.css";
import { ProjectsPicker } from "./projects-picker";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  proyectos: Proyecto[];
  loading: boolean;
  error: string | null;
  onSelect: (proyecto: Proyecto) => void;
};

export function SelectProjectModal({
  isOpen,
  onClose,
  proyectos,
  loading,
  error,
  onSelect,
}: Props) {
  if (!isOpen) return null;

  const handleSelect = (proyecto: Proyecto) => {
    onSelect(proyecto);
    // el cierre del modal lo maneja handleSelectProyecto en App.tsx
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div className="modalHeader">
          <h2 className="modalTitle">Abrir proyecto</h2>
          <button
            type="button"
            onClick={onClose}
            className="modalCloseBtn"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="modalBody">
          <ProjectsPicker
            proyectos={proyectos}
            loading={loading}
            error={error}
            onSelect={handleSelect}
            title="" // el título ya está en el header del modal
          />
        </div>

        <div className="modalFooter">
          <button type="button" onClick={onClose} className="modalSecondaryBtn">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
