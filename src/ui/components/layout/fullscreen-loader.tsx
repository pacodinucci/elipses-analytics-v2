// src/components/layout/full-screen-loader.tsx
import "./fullscreen-loader.css";

type Props = {
  label?: string;
};

export function FullScreenLoader({ label = "Cargando..." }: Props) {
  return (
    <div className="fs-loader">
      <div className="fs-loader__card">
        <div className="fs-loader__spinner" />
        <div className="fs-loader__label">{label}</div>
      </div>
    </div>
  );
}
