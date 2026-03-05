import "./projects-table.css";
import { FaRegFolderOpen } from "react-icons/fa6";

type Props = {
  proyectos: Proyecto[];
  selectedProyectoId?: string | null;
  onSelect: (p: Proyecto) => void;
};

function formatDateYYYYMMDD(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  // si viene ISO, cortamos
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export function ProjectsTable({
  proyectos,
  selectedProyectoId,
  onSelect,
}: Props) {
  return (
    <table className="simpleTable">
      <tbody>
        {proyectos.map((p) => {
          const isActive = selectedProyectoId === p.id;

          // v2: store ya normaliza nombre -> p.nombre
          const nombre = (p as any).nombre ?? (p as any).name ?? "";

          // v2: si existe descripcion, la mostramos como subtítulo
          const descripcion = String(
            (p as any).descripcion ?? (p as any).description ?? "",
          ).trim();

          const subtitle = descripcion || "Proyecto";

          // meta derecha: updatedAt si existe
          const rightMeta = formatDateYYYYMMDD(
            (p as any).updatedAt ?? (p as any).createdAt,
          );

          return (
            <tr
              key={p.id}
              className={`simpleTable__row ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(p);
              }}
            >
              <td className="simpleTable__cell simpleTable__cell--main">
                <div className="simpleTable__item">
                  <div className="simpleTable__icon" aria-hidden="true">
                    <FaRegFolderOpen />
                  </div>

                  <div className="simpleTable__texts">
                    <div className="simpleTable__primary">{nombre}</div>
                    <div className="simpleTable__secondary">{subtitle}</div>
                  </div>
                </div>
              </td>

              <td className="simpleTable__cell simpleTable__cell--meta">
                {rightMeta}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
