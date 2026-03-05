// src/components/project/new-project-modal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./new-project-modal.css";
import { useNewProjectWizardStore } from "../../store/new-project-wizard-store";
import type { CSSProperties } from "react";

/**
 * ✅ IMPORTANTE
 * Estás con react-window@2.2.7, y esa versión NO expone FixedSizeList (API cambió).
 * Para destrabar YA (sin pelear con versiones), saco react-window y meto un virtual list
 * simple (fixed row height) sin dependencias.
 */

type VirtualRowProps<T> = {
  index: number;
  style: CSSProperties;
  data: T;
};

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

const CAPA_FIELDS = [{ key: "nombre", label: "Nombre" }] as const;

const POZO_FIELDS = [
  { key: "nombre", label: "Nombre" },
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
] as const;

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

    capasImport,
    pozosImport,

    setImportFromContent,
    setImportMapping,
    setImportCell,

    setImportRowSelected,
    setImportColSelected,
    setImportAllRowsSelected,
    setImportAllColsSelected,

    validateImport,
    buildContentForCommit,
    clearImport,

    normalizeCapasNames,
  } = useNewProjectWizardStore();

  useEffect(() => {
    if (!isOpen) return;

    const isEmpty =
      !draft?.nombre &&
      !draft?.limitesTemporalDesde &&
      !draft?.limitesTemporalHasta &&
      !draft?.grillaN &&
      !proyecto;

    if (isEmpty) {
      reset();
      setDraft(makeDefaults());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // debounce validation (no bloquea UI)
  useEffect(() => {
    if (step !== "capas") return;
    if (!capasFile) return;
    const t = window.setTimeout(() => validateImport("Capa"), 140);
    return () => window.clearTimeout(t);
  }, [
    step,
    capasFile,
    capasImport.selectedRows,
    capasImport.selectedCols,
    capasImport.mapping,
    capasImport.rows,
    validateImport,
  ]);

  useEffect(() => {
    if (step !== "pozos") return;
    if (!pozosFile) return;
    const t = window.setTimeout(() => validateImport("Pozo"), 140);
    return () => window.clearTimeout(t);
  }, [
    step,
    pozosFile,
    pozosImport.selectedRows,
    pozosImport.selectedCols,
    pozosImport.mapping,
    pozosImport.rows,
    validateImport,
  ]);

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
  // Step 2: Capas
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

      // Si no se adjunta archivo, se permite avanzar.
      if (!capasFile) {
        clearImport("Capa");
        setStep("pozos");
        return;
      }

      const okLocal = validateImport("Capa");
      if (!okLocal) {
        setError(
          "Hay errores de mapping o filas inválidas. Corregí antes de continuar.",
        );
        return;
      }

      const contentFinal = buildContentForCommit("Capa");
      const payload = { proyectoId: proyecto.id, content: contentFinal };

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

      clearImport("Capa");
      setStep("pozos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error importando capas");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Step 3: Pozos (FIN)
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

      // Si no se adjunta archivo, se permite finalizar igual.
      if (pozosFile) {
        const okLocal = validateImport("Pozo");
        if (!okLocal) {
          setError(
            "Hay errores de mapping o filas inválidas. Corregí antes de finalizar.",
          );
          return;
        }

        const contentFinal = buildContentForCommit("Pozo");
        const payload = { proyectoId: proyecto.id, content: contentFinal };

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

        clearImport("Pozo");

        try {
          await window.electron.coreProyectoRecomputeArealFromPozos({
            proyectoId: proyecto.id,
            margenX: 100,
            margenY: 100,
          } as any);
        } catch {
          // noop
        }
      } else {
        clearImport("Pozo");
      }

      // ✅ FIN del wizard
      onCreated?.(proyecto);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error importando pozos");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const capasMappingErrors = capasImport.mappingErrors?.length ?? 0;
  const capasRowErrors = Object.keys(capasImport.rowErrors ?? {}).length;

  const pozosMappingErrors = pozosImport.mappingErrors?.length ?? 0;
  const pozosRowErrors = Object.keys(pozosImport.rowErrors ?? {}).length;

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
          <StepChip
            active={step === "capas"}
            done={step !== "proyecto" && step !== "capas"}
          >
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
                Cargá un TXT tabular. Podés desestimar columnas / filas.
              </p>

              <FileField
                label="Archivo de capas (TXT)"
                accept=".txt"
                file={capasFile}
                onChange={async (f) => {
                  setCapasFile(f);

                  if (!f) {
                    clearImport("Capa");
                    return;
                  }

                  try {
                    const text = await f.text();
                    setImportFromContent("Capa", text);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "No se pudo leer el archivo",
                    );
                  }
                }}
                disabled={loading}
              />

              {capasFile ? (
                <ImportMappingTable
                  titleLeft={`Filas: ${capasImport.rows.length}`}
                  titleRight={`Mapping errs: ${capasMappingErrors} | Row errs: ${capasRowErrors}`}
                  columns={capasImport.columns}
                  columnUnits={capasImport.columnUnits}
                  selectedCols={capasImport.selectedCols}
                  selectedRows={capasImport.selectedRows}
                  rows={capasImport.rows}
                  mapping={capasImport.mapping}
                  rowErrors={capasImport.rowErrors}
                  mappingErrors={capasImport.mappingErrors}
                  fieldOptions={CAPA_FIELDS as any}
                  onChangeMapping={(col, m) =>
                    setImportMapping("Capa", col, m as any)
                  }
                  onChangeColSelected={(col, sel) =>
                    setImportColSelected("Capa", col, sel)
                  }
                  onChangeAllCols={(sel) =>
                    setImportAllColsSelected("Capa", sel)
                  }
                  onChangeRowSelected={(row, sel) =>
                    setImportRowSelected("Capa", row, sel)
                  }
                  onChangeAllRows={(sel) =>
                    setImportAllRowsSelected("Capa", sel)
                  }
                  onChangeCell={(r, c, v) => setImportCell("Capa", r, c, v)}
                  extraRight={
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => normalizeCapasNames()}
                      disabled={loading || capasImport.rows.length === 0}
                    >
                      Normalizar
                    </button>
                  }
                  disabled={loading}
                />
              ) : null}

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
                  disabled={
                    loading ||
                    !proyecto?.id ||
                    (capasFile
                      ? capasMappingErrors > 0 || capasRowErrors > 0
                      : false)
                  }
                >
                  {loading ? "Importando..." : "Continuar"}
                </button>
              </div>
            </div>
          )}

          {step === "pozos" && (
            <div className="npm-form">
              <p className="npm-hint">
                Cargá un TXT tabular (tabs/espacios). Podés desestimar columnas
                / filas.
              </p>

              <FileField
                label="Archivo de pozos (TXT)"
                accept=".txt"
                file={pozosFile}
                onChange={async (f) => {
                  setPozosFile(f);

                  if (!f) {
                    clearImport("Pozo");
                    return;
                  }

                  try {
                    const text = await f.text();
                    setImportFromContent("Pozo", text);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "No se pudo leer el archivo",
                    );
                  }
                }}
                disabled={loading}
              />

              {pozosFile ? (
                <ImportMappingTable
                  titleLeft={`Filas: ${pozosImport.rows.length}`}
                  titleRight={`Mapping errs: ${pozosMappingErrors} | Row errs: ${pozosRowErrors}`}
                  columns={pozosImport.columns}
                  columnUnits={pozosImport.columnUnits}
                  selectedCols={pozosImport.selectedCols}
                  selectedRows={pozosImport.selectedRows}
                  rows={pozosImport.rows}
                  mapping={pozosImport.mapping}
                  rowErrors={pozosImport.rowErrors}
                  mappingErrors={pozosImport.mappingErrors}
                  fieldOptions={POZO_FIELDS as any}
                  onChangeMapping={(col, m) =>
                    setImportMapping("Pozo", col, m as any)
                  }
                  onChangeColSelected={(col, sel) =>
                    setImportColSelected("Pozo", col, sel)
                  }
                  onChangeAllCols={(sel) =>
                    setImportAllColsSelected("Pozo", sel)
                  }
                  onChangeRowSelected={(row, sel) =>
                    setImportRowSelected("Pozo", row, sel)
                  }
                  onChangeAllRows={(sel) =>
                    setImportAllRowsSelected("Pozo", sel)
                  }
                  onChangeCell={(r, c, v) => setImportCell("Pozo", r, c, v)}
                  disabled={loading}
                />
              ) : null}

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
                  disabled={
                    loading ||
                    !proyecto?.id ||
                    (pozosFile
                      ? pozosMappingErrors > 0 || pozosRowErrors > 0
                      : false)
                  }
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

/** ===== Virtualized Mapping Table (sin react-window) ===== */

function ImportMappingTable(props: {
  titleLeft: string;
  titleRight: string;
  columns: string[];
  columnUnits?: string[];

  selectedCols: boolean[];
  selectedRows: boolean[];

  rows: { rowNumber: number; cells: string[] }[];
  mapping: Array<string>;
  rowErrors: Record<number, string[]>;
  mappingErrors: string[];
  fieldOptions: Array<{ key: string; label: string }>;
  onChangeMapping: (colIndex: number, mapping: string) => void;

  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;

  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;

  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  extraRight?: React.ReactNode;
  disabled?: boolean;
}) {
  const {
    titleLeft,
    titleRight,
    columns,
    columnUnits,
    selectedCols,
    selectedRows,
    rows,
    mapping,
    rowErrors,
    mappingErrors,
    fieldOptions,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    extraRight,
    disabled,
  } = props;

  const allRowsChecked =
    selectedRows.length > 0 && selectedRows.every((v) => v === true);
  const someRowsChecked = selectedRows.some((v) => v === true);

  const allColsChecked =
    selectedCols.length > 0 && selectedCols.every((v) => v === true);
  const someColsChecked = selectedCols.some((v) => v === true);

  // layout
  const COL_W_LINE = 70;
  const COL_W_SEL = 44;
  const COL_W_DATA = 240;
  const COL_W_COLMASTER = 44;

  const gridTemplateColumns = useMemo(() => {
    const dataCols = columns.map(() => `${COL_W_DATA}px`).join(" ");
    return `${COL_W_LINE}px ${COL_W_SEL}px ${dataCols} ${COL_W_COLMASTER}px`;
  }, [columns]);

  const totalWidth = useMemo(() => {
    return (
      COL_W_LINE + COL_W_SEL + columns.length * COL_W_DATA + COL_W_COLMASTER
    );
  }, [columns.length]);

  const ROW_HEIGHT = 46;
  const LIST_HEIGHT = 420;

  type RowData = {
    rows: { rowNumber: number; cells: string[] }[];
    columns: string[];
    selectedCols: boolean[];
    selectedRows: boolean[];
    mapping: string[];
    rowErrors: Record<number, string[]>;
    disabled?: boolean;
    onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
    onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  };

  const itemData: RowData = useMemo(
    () => ({
      rows,
      columns,
      selectedCols,
      selectedRows,
      mapping,
      rowErrors,
      disabled,
      onChangeRowSelected,
      onChangeCell,
    }),
    [
      rows,
      columns,
      selectedCols,
      selectedRows,
      mapping,
      rowErrors,
      disabled,
      onChangeRowSelected,
      onChangeCell,
    ],
  );

  const Row = ({ index, style, data }: VirtualRowProps<RowData>) => {
    const row = data.rows[index];
    const isRowSelected = data.selectedRows[index] ?? true;
    const errs = data.rowErrors[index] ?? [];

    return (
      <div
        className={`npm-vrow ${errs.length ? "npm-vrow-haserror" : ""}`}
        style={{ ...style, gridTemplateColumns }}
      >
        <div className="npm-vcell npm-vcell-line">{row.rowNumber}</div>

        <div className="npm-vcell npm-vcell-sel">
          <input
            type="checkbox"
            checked={isRowSelected}
            onChange={(e) => data.onChangeRowSelected(index, e.target.checked)}
            disabled={data.disabled}
            aria-label={`Incluir fila ${row.rowNumber}`}
          />
        </div>

        {data.columns.map((_, cIdx) => {
          const colEnabled = data.selectedCols[cIdx] ?? true;
          const isIgnored =
            (data.mapping[cIdx] ?? "__ignore__") === "__ignore__";

          const cellDisabled = data.disabled || !colEnabled || !isRowSelected;

          const cls = [
            "npm-vcell",
            "npm-vcell-data",
            isIgnored ? "npm-vcell-ignored" : "",
            !colEnabled ? "npm-vcell-disabled" : "",
            !isRowSelected ? "npm-vcell-rowdisabled" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={cIdx} className={cls}>
              <input
                className="npm-vinput"
                value={row.cells[cIdx] ?? ""}
                onChange={(e) => data.onChangeCell(index, cIdx, e.target.value)}
                disabled={cellDisabled}
              />
            </div>
          );
        })}

        <div className="npm-vcell npm-vcell-colmaster" />
      </div>
    );
  };

  return (
    <div className="npm-preview">
      <div className="npm-previewbar">
        <span className="npm-badge">{titleLeft}</span>

        <div className="npm-previewbar-right">
          {extraRight}
          <span className="npm-badge">{titleRight}</span>
        </div>
      </div>

      {mappingErrors.length > 0 ? (
        <div className="npm-maperror">
          <strong>Problemas de mapeo:</strong>
          <ul>
            {mappingErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="npm-tablewrap npm-tablewrap--virt">
        <div className="npm-virt-scroll">
          {/* HEADER */}
          <div
            className="npm-vhead"
            style={{ gridTemplateColumns, width: totalWidth }}
          >
            <div className="npm-vhcell npm-vhcell-line">Línea</div>

            <div className="npm-vhcell npm-vhcell-sel">
              <input
                type="checkbox"
                checked={allRowsChecked}
                ref={(el) => {
                  if (!el) return;
                  el.indeterminate = !allRowsChecked && someRowsChecked;
                }}
                onChange={(e) => onChangeAllRows(e.target.checked)}
                disabled={disabled}
                aria-label="Seleccionar todas las filas"
                title="Seleccionar todas las filas"
              />
            </div>

            {columns.map((col, cIdx) => {
              const current = mapping[cIdx] ?? "__ignore__";
              const unit = (columnUnits?.[cIdx] ?? "").trim();
              const colEnabled = selectedCols[cIdx] ?? true;

              return (
                <div
                  key={cIdx}
                  className={`npm-vhcell npm-vhcell-data ${
                    !colEnabled ? "npm-vhcell-disabled" : ""
                  }`}
                >
                  <div className="npm-vh-top">
                    <div className="npm-vh-title">{col}</div>
                    <input
                      type="checkbox"
                      checked={colEnabled}
                      onChange={(e) =>
                        onChangeColSelected(cIdx, e.target.checked)
                      }
                      disabled={disabled}
                      aria-label={`Incluir columna ${col}`}
                      title="Incluir/Excluir columna"
                    />
                  </div>

                  {unit ? <div className="npm-vh-unit">{unit}</div> : null}

                  <select
                    className="npm-vh-select"
                    value={current}
                    onChange={(e) => onChangeMapping(cIdx, e.target.value)}
                    disabled={disabled || !colEnabled}
                  >
                    <option value="__ignore__">Ignorar</option>
                    {fieldOptions.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <div className="npm-vhcell npm-vhcell-colmaster">
              <input
                type="checkbox"
                checked={allColsChecked}
                ref={(el) => {
                  if (!el) return;
                  el.indeterminate = !allColsChecked && someColsChecked;
                }}
                onChange={(e) => onChangeAllCols(e.target.checked)}
                disabled={disabled}
                aria-label="Seleccionar todas las columnas"
                title="Seleccionar todas las columnas"
              />
            </div>
          </div>

          {/* BODY (virtualized) */}
          <div style={{ width: totalWidth }}>
            <FixedVirtualList<RowData>
              height={LIST_HEIGHT}
              width={totalWidth}
              itemCount={rows.length}
              itemSize={ROW_HEIGHT}
              itemData={itemData}
              overscan={6}
            >
              {Row}
            </FixedVirtualList>
          </div>
        </div>
      </div>

      {Object.keys(rowErrors).length > 0 ? (
        <div className="npm-maperror">
          <strong>Errores de filas:</strong> Hay {Object.keys(rowErrors).length}{" "}
          filas con problemas (solo cuenta filas seleccionadas).
          <div className="npm-maperrorhint">
            Tip: revisá duplicados (case-insensitive), vacíos o números
            inválidos.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Virtual list fijo (row height constante).
 * - Renderiza solo el rango visible + overscan.
 * - Sin dependencias externas.
 */
function FixedVirtualList<T>(props: {
  height: number;
  width: number;
  itemCount: number;
  itemSize: number;
  itemData: T;
  overscan?: number;
  children: (p: VirtualRowProps<T>) => React.ReactNode;
}) {
  const {
    height,
    width,
    itemCount,
    itemSize,
    itemData,
    overscan = 6,
    children,
  } = props;

  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = itemCount * itemSize;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscan);
  const visibleCount = Math.ceil(height / itemSize) + overscan * 2;
  const endIndex = Math.min(itemCount - 1, startIndex + visibleCount);

  const items: React.ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i += 1) {
    items.push(
      <React.Fragment key={i}>
        {children({
          index: i,
          data: itemData,
          style: {
            position: "absolute",
            top: i * itemSize,
            height: itemSize,
            width: "100%",
          },
        })}
      </React.Fragment>,
    );
  }

  return (
    <div
      ref={ref}
      style={{
        height,
        width,
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
      }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>{items}</div>
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
