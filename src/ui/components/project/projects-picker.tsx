// src/components/project/projects-picker.tsx
import { ProjectsTable } from "./projects-table";
import "./projects-picker.css";

type Props = {
  proyectos: Proyecto[];
  loading: boolean;
  error: string | null;
  onSelect: (proyecto: Proyecto) => void;

  // UI opcional
  title?: string;
  hint?: string;
  className?: string;
};

export function ProjectsPicker({
  proyectos,
  loading,
  error,
  onSelect,
  title = "Proyectos",
  hint,
  className,
}: Props) {
  return (
    <div className={`projectsPicker ${className ?? ""}`}>
      <div className="projectsPicker__head">
        <div className="projectsPicker__title">{title}</div>
        {hint ? <div className="projectsPicker__hint">{hint}</div> : null}
      </div>

      {loading && (
        <p className="projectsPicker__loading">Cargando proyectos...</p>
      )}
      {error && <p className="projectsPicker__error">Error: {error}</p>}

      <div className="projectsPicker__body">
        <div className="projectsPicker__tableWrap">
          <ProjectsTable proyectos={proyectos} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}
