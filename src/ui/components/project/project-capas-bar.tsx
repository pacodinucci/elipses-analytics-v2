// src/components/project/project-capas-bar.tsx
import { useEffect } from "react";
import { useCapas } from "../../hooks/use-capas";
import "./project-capas-bar.css";

type Props = {
  proyectoId: string;
  selectedCapaName: string | null;
  onSelectCapa: (capaNombre: string) => void;

  position?: "top" | "left";
};

export function ProyectoCapasBar({
  proyectoId,
  selectedCapaName,
  onSelectCapa,
  position = "top",
}: Props) {
  const { capas, loading, error } = useCapas(proyectoId);

  useEffect(() => {
    if (!loading && capas.length > 0 && !selectedCapaName) {
      onSelectCapa(capas[0].nombre);
    }
  }, [loading, capas, selectedCapaName, onSelectCapa]);

  const className = `capasbar capasbar--${position}`;

  if (loading) {
    return (
      <div className={className}>
        <div className="capasbar__state">Cargando capas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="capasbar__state capasbar__state--error">
          Error al cargar capas: {error}
        </div>
      </div>
    );
  }

  if (!capas.length) return null;

  return (
    <div className={className}>
      <div className="capasbar__wrap">
        {capas.map((capa: CapaRow) => {
          const isSelected = capa.nombre === selectedCapaName;
          return (
            <button
              key={capa.id}
              type="button"
              onClick={() => onSelectCapa(capa.nombre)}
              className={`capasbar__btn ${isSelected ? "is-selected" : ""}`}
            >
              {capa.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
