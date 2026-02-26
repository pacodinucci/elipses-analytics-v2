import { FaPlus } from "react-icons/fa";

import { ProjectsTable } from "./projects-table";

type Props = {
  proyectos: Proyecto[];
  proyectosLoading: boolean;
  proyectosError: string | null;

  selectedProyecto: Proyecto | null;
  onSelectProyecto: (p: Proyecto) => void;
  onCrearProyecto: () => void;
};

export function ProjectYacimientoStartScreen({
  proyectos,
  proyectosLoading,
  proyectosError,
  selectedProyecto,
  onSelectProyecto,
  onCrearProyecto,
}: Props) {
  return (
    <div className="startScreen">
      <div className="startScreen__grid">
        <div className="startPanel">
          <div className="startPanel__top">
            <div className="startPanel__desc">
              Seleccioná o creá un proyecto para comenzar.
            </div>

            <div className="startPanel__actionsRow">
              <button
                type="button"
                onClick={onCrearProyecto}
                className="btn btn--secondary"
              >
                <FaPlus />
                Crear proyecto
              </button>
            </div>
          </div>

          {proyectosLoading && (
            <div className="startPanel__hint">Cargando proyectos...</div>
          )}
          {proyectosError && (
            <div className="startPanel__error">Error: {proyectosError}</div>
          )}

          <div className="startPanel__tableWrap">
            <ProjectsTable
              proyectos={proyectos}
              selectedProyectoId={selectedProyecto?.id ?? null}
              onSelect={onSelectProyecto}
            />
          </div>

          {/* Opcional: hint cuando ya hay proyecto seleccionado */}
          {selectedProyecto ? (
            <div className="startPanel__hint">
              Proyecto seleccionado: <b>{selectedProyecto.nombre}</b>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
