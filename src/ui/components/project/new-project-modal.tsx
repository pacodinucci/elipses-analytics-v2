// src/components/project/new-project-modal.tsx
import { useState } from "react";
import { useProyectos } from "../../hooks/use-proyectos";

import "./new-project-modal.css";

export type ProyectoFormState = {
  nombre: string;
  descripcion?: string;
};

type NewProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (proyecto: Proyecto) => void;
};

export function NewProjectModal({
  isOpen,
  onClose,
  onCreated,
}: NewProjectModalProps) {
  const { createProyecto, loading, error } = useProyectos();

  const [form, setForm] = useState<ProyectoFormState>({
    nombre: "",
    descripcion: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;

    try {
      const proyecto = await createProyecto({
        // ✅ v2: solo usamos nombre/descripcion (el store ya mapea a coreProyectoInitialize)
        nombre: form.nombre.trim(),
        // legacy fields (no usados en v2, pero el store los tolera)
        fecha_inicio: "",
        fecha_fin: "",
        alias: "",
        descripcion: form.descripcion?.trim() || "",
      });

      setForm({ nombre: "", descripcion: "" });

      onCreated?.(proyecto);
      onClose();
    } catch {
      // error manejado por el store/hook
    }
  };

  if (!isOpen) return null;

  return (
    <div className="npm-overlay">
      <div className="npm-modal">
        <div className="npm-header">
          <h2 className="npm-title">Nuevo Proyecto</h2>
          <button
            type="button"
            className="npm-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form className="npm-form" onSubmit={handleSubmit}>
          <FormField
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            required
          />

          <FormField
            label="Descripción"
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
          />

          {error && <p className="npm-error">Error: {error}</p>}

          <div className="npm-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn--secondary"
              disabled={loading}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
            >
              {loading ? "Creando..." : "Crear proyecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value?: string;
  type?: string;
  required?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function FormField({
  label,
  name,
  value,
  type = "text",
  required,
  onChange,
}: FieldProps) {
  return (
    <div className="npm-field">
      <label className="npm-label">{label}</label>
      <input
        className="npm-input"
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        required={required}
      />
    </div>
  );
}
