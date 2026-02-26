// src/components/layout/breadcrumb-bar.tsx
import "./breadcrumb-bar.css";

type BreadcrumbBarProps = {
  selectedProyecto: Proyecto | null;
  // opcional: si después querés mostrar la capa seleccionada en el breadcrumb
  selectedCapaName?: string | null;
};

export function BreadcrumbBar({
  selectedProyecto,
  selectedCapaName = null,
}: BreadcrumbBarProps) {
  if (!selectedProyecto) return null;

  return (
    <div className="breadcrumbBar">
      <span className="breadcrumbBar__project">{selectedProyecto.nombre}</span>

      {selectedCapaName ? (
        <>
          <span className="breadcrumbBar__sep">/</span>
          <span className="breadcrumbBar__capa">{selectedCapaName}</span>
        </>
      ) : null}
    </div>
  );
}
