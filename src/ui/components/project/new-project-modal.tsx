// src/components/project/new-project-modal.tsx
import { useEffect, useMemo } from "react";
import "./new-project-modal.css";
import { useNewProjectWizardStore } from "../../store/new-project-wizard-store";

type NewProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (proyecto: Proyecto) => void;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeDefaults() {
  const from = todayISO();
  const to = `${new Date().getFullYear() + 5}-12-31`;
  return {
    nombre: "",
    limitesTemporalDesde: from,
    limitesTemporalHasta: to,
    grillaN: "200",
  };
}

function parseIntStrict(value: string, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${field} debe ser un entero`);
  }
  return n;
}

function firstImportErrorMessage(dryOrCommit: any): string {
  const msg = dryOrCommit?.errors?.[0]?.message;
  return typeof msg === "string" && msg.trim() ? msg : "ver detalle";
}

export function NewProjectModal({
  isOpen,
  onClose,
  onCreated,
}: NewProjectModalProps) {
  const {
    step,
    draft,
    proyecto,
    capasFile,
    pozosFile,
    loading,
    error,
    setStep,
    setDraft,
    setProyecto,
    setCapasFile,
    setPozosFile,
    setLoading,
    setError,
    reset,
  } = useNewProjectWizardStore();

  // ✅ Defaults al abrir si el wizard está "vacío"
  useEffect(() => {
    if (!isOpen) return;

    const isEmpty =
      !draft?.nombre &&
      !draft?.limitesTemporalDesde &&
      !draft?.limitesTemporalHasta &&
      !draft?.grillaN &&
      !proyecto;

    if (isEmpty) {
      // reset() ya crea defaults, pero si querés asegurar mismos defaults que el modal:
      reset();
      // y si querés forzar defaults exactos:
      setDraft(makeDefaults());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const canCreateProyecto = useMemo(() => {
    return draft.nombre.trim().length > 0 && !loading;
  }, [draft.nombre, loading]);

  const close = () => {
    reset();
    onClose();
  };

  const onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDraft({ [name]: value } as any);
  };

  // -----------------------
  // Step 1: Crear Proyecto
  // -----------------------
  const handleCreateProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const nombre = draft.nombre.trim();
      if (!nombre) throw new Error("Nombre es requerido");

      const n = parseIntStrict(draft.grillaN, "Dimensión de grilla");
      if (n <= 0) throw new Error("Dimensión de grilla debe ser > 0");

      const { proyecto: created } =
        await window.electron.coreProyectoInitialize({
          nombre,
          limitesTemporalDesde: draft.limitesTemporalDesde,
          limitesTemporalHasta: draft.limitesTemporalHasta,
          gridDim: n,
        } as any);

      if (!created?.id) {
        throw new Error(
          "coreProyectoInitialize no devolvió un proyecto válido",
        );
      }

      setProyecto(created);
      setStep("capas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando proyecto");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Step 2: Import Capas
  // -----------------------
  const handleImportCapasAndNext = async () => {
    setError("");

    if (!proyecto?.id) {
      setError("Proyecto no creado (id faltante). Volvé al paso 1.");
      setStep("proyecto");
      return;
    }

    try {
      setLoading(true);

      // capas opcional
      if (!capasFile) {
        setStep("pozos");
        return;
      }

      const content = await capasFile.text();
      const payload = { proyectoId: proyecto.id, content };

      const dry = await window.electron.importCapasDryRun(payload as any);
      if (dry.status === "failed") {
        throw new Error(`Import capas falló: ${firstImportErrorMessage(dry)}`);
      }

      const commit = await window.electron.importCapasCommit(payload as any);
      if (commit.status === "failed") {
        throw new Error(
          `Import capas (commit) falló: ${firstImportErrorMessage(commit)}`,
        );
      }

      setStep("pozos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error importando capas");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Step 3: Import Pozos + recompute areal
  // -----------------------
  const handleImportPozosAndFinish = async () => {
    setError("");

    if (!proyecto?.id) {
      setError("Proyecto no creado (id faltante). Volvé al paso 1.");
      setStep("proyecto");
      return;
    }

    try {
      setLoading(true);

      // pozos opcional
      if (pozosFile) {
        const content = await pozosFile.text();
        const payload = { proyectoId: proyecto.id, content };

        const dry = await window.electron.importPozosDryRun(payload as any);
        if (dry.status === "failed") {
          throw new Error(
            `Import pozos falló: ${firstImportErrorMessage(dry)}`,
          );
        }

        const commit = await window.electron.importPozosCommit(payload as any);
        if (commit.status === "failed") {
          throw new Error(
            `Import pozos (commit) falló: ${firstImportErrorMessage(commit)}`,
          );
        }

        // recompute areal (si falla, no bloquea)
        try {
          const { proyecto: updated } =
            await window.electron.coreProyectoRecomputeArealFromPozos({
              proyectoId: proyecto.id,
              margenX: 100,
              margenY: 100,
            } as any);

          onCreated?.(updated ?? proyecto);
          close();
          return;
        } catch {
          // noop
        }
      }

      onCreated?.(proyecto);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error importando pozos");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="npm-overlay">
      <div className="npm-modal">
        <div className="npm-header">
          <div className="npm-header-left">
            <h2 className="npm-title">Crear proyecto</h2>

            {proyecto?.nombre ? (
              <span className="npm-subtitle">{proyecto.nombre}</span>
            ) : null}
          </div>

          <button
            type="button"
            className="npm-close"
            onClick={close}
            disabled={loading}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="npm-steps">
          <StepChip active={step === "proyecto"} done={!!proyecto?.id}>
            1) Proyecto
          </StepChip>
          <StepChip active={step === "capas"} done={step === "pozos"}>
            2) Capas
          </StepChip>
          <StepChip active={step === "pozos"} done={false}>
            3) Pozos
          </StepChip>
        </div>

        <div className="npm-body">
          {error && <p className="npm-error">Error: {error}</p>}

          {step === "proyecto" && (
            <form className="npm-form" onSubmit={handleCreateProyecto}>
              <FormField
                label="Nombre"
                name="nombre"
                value={draft.nombre}
                onChange={onChangeInput}
                required
              />

              <div className="npm-row npm-row--triple">
                <FormField
                  label="Desde"
                  name="limitesTemporalDesde"
                  value={draft.limitesTemporalDesde}
                  onChange={onChangeInput}
                  type="date"
                  required
                />
                <FormField
                  label="Hasta"
                  name="limitesTemporalHasta"
                  value={draft.limitesTemporalHasta}
                  onChange={onChangeInput}
                  type="date"
                  required
                />
                <FormField
                  label="Dimensión grilla (N×N)"
                  name="grillaN"
                  value={draft.grillaN}
                  onChange={onChangeInput}
                  type="number"
                  required
                />
              </div>

              <div className="npm-actions">
                <button
                  type="button"
                  onClick={close}
                  className="btn btn--secondary"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!canCreateProyecto}
                >
                  {loading ? "Creando..." : "Crear proyecto"}
                </button>
              </div>
            </form>
          )}

          {step === "capas" && (
            <div className="npm-form">
              <p className="npm-hint">
                Cargá el TXT de capas (opcional). Formato: primera línea puede
                ser <code>capa</code> y luego una capa por línea.
              </p>

              <FileField
                label="Archivo de capas (TXT)"
                accept=".txt"
                file={capasFile}
                onChange={setCapasFile}
                disabled={loading}
              />

              <div className="npm-actions">
                <button
                  type="button"
                  onClick={() => setStep("proyecto")}
                  className="btn btn--secondary"
                  disabled={loading}
                >
                  Volver
                </button>

                <button
                  type="button"
                  onClick={handleImportCapasAndNext}
                  className="btn btn--primary"
                  disabled={loading || !proyecto?.id}
                >
                  {loading ? "Importando..." : "Continuar"}
                </button>
              </div>
            </div>
          )}

          {step === "pozos" && (
            <div className="npm-form">
              <p className="npm-hint">
                Cargá el TXT de pozos (opcional). Formato: header{" "}
                <code>pozo x y</code>, filas separadas por tabs/espacios. X
                puede venir con coma decimal.
              </p>

              <FileField
                label="Archivo de pozos (TXT: pozo x y)"
                accept=".txt"
                file={pozosFile}
                onChange={setPozosFile}
                disabled={loading}
              />

              <div className="npm-actions">
                <button
                  type="button"
                  onClick={() => setStep("capas")}
                  className="btn btn--secondary"
                  disabled={loading}
                >
                  Volver
                </button>

                <button
                  type="button"
                  onClick={handleImportPozosAndFinish}
                  className="btn btn--primary"
                  disabled={loading || !proyecto?.id}
                >
                  {loading ? "Finalizando..." : "Finalizar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepChip({
  active,
  done,
  children,
}: {
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`npm-stepchip ${active ? "is-active" : ""} ${
        done ? "is-done" : ""
      }`}
    >
      {children}
    </span>
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

function FileField({
  label,
  accept,
  file,
  onChange,
  disabled,
}: {
  label: string;
  accept?: string;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="npm-field">
      <label className="npm-label">{label}</label>
      <input
        className="npm-input"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
        }}
      />
      {file && <div className="npm-filemeta">{file.name}</div>}
    </div>
  );
}
