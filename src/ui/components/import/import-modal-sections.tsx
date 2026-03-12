import React, { useEffect, useMemo, useState } from "react";
import {
  buildInvalidBulkReplaceGroups,
  groupRowsByLabel,
} from "./import-modal.helpers";
import {
  ImportKind,
  InvalidCellsMap,
  InvalidBulkReplaceGroup,
  POZOCAPA_FIELDS,
  PozoCapaResolveReport,
  PozoCapaViewMode,
  SCENARIO_TYPE_OPTIONS,
  SET_ESTADO_POZOS_FIELDS,
  ScenarioResolveReport,
  ScenarioViewMode,
  SetEstadoPozosImportState,
  SetEstadoPozosResolveReport,
  SetEstadoPozosViewMode,
} from "./import-modal.types";

/** =========================
 *  Tabla virtualizada
 *  ========================= */

type VirtualRowProps2<T> = {
  index: number;
  style: React.CSSProperties;
  data: T;
};

export function ImportMappingTable(props: {
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
  rowIndexMap?: number[] | null;
  invalidCells?: InvalidCellsMap;
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
    rowIndexMap,
    invalidCells,
  } = props;

  const viewIndices = useMemo(() => {
    if (rowIndexMap && rowIndexMap.length >= 0) return rowIndexMap;
    return null;
  }, [rowIndexMap]);

  const allRowsChecked = useMemo(() => {
    const indices = viewIndices ?? rows.map((_, i) => i);
    return (
      indices.length > 0 &&
      indices.every((i) => (selectedRows[i] ?? true) === true)
    );
  }, [viewIndices, rows, selectedRows]);

  const someRowsChecked = useMemo(() => {
    const indices = viewIndices ?? rows.map((_, i) => i);
    return indices.some((i) => (selectedRows[i] ?? true) === true);
  }, [viewIndices, rows, selectedRows]);

  const allColsChecked =
    selectedCols.length > 0 && selectedCols.every((v) => v === true);
  const someColsChecked = selectedCols.some((v) => v === true);

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
    rowIndexMap?: number[] | null;
    invalidCells?: InvalidCellsMap;
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
      rowIndexMap: viewIndices,
      invalidCells,
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
      viewIndices,
      invalidCells,
      onChangeRowSelected,
      onChangeCell,
    ],
  );

  const Row = ({ index, style, data }: VirtualRowProps2<RowData>) => {
    const srcIndex = data.rowIndexMap ? data.rowIndexMap[index] : index;

    const row = data.rows[srcIndex];
    const isRowSelected = data.selectedRows[srcIndex] ?? true;
    const errs = data.rowErrors[srcIndex] ?? [];

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
            onChange={(e) =>
              data.onChangeRowSelected(srcIndex, e.target.checked)
            }
            disabled={data.disabled}
            aria-label={`Incluir fila ${row.rowNumber}`}
          />
        </div>

        {data.columns.map((_, cIdx) => {
          const colEnabled = data.selectedCols[cIdx] ?? true;
          const isIgnored =
            (data.mapping[cIdx] ?? "__ignore__") === "__ignore__";
          const cellDisabled = data.disabled || !colEnabled || !isRowSelected;

          const invalidKey = `${srcIndex}:${cIdx}`;
          const invalidReason = data.invalidCells?.[invalidKey];

          const cls = [
            "npm-vcell",
            "npm-vcell-data",
            isIgnored ? "npm-vcell-ignored" : "",
            !colEnabled ? "npm-vcell-disabled" : "",
            !isRowSelected ? "npm-vcell-rowdisabled" : "",
            invalidReason ? "npm-vcell-invalid" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={cIdx}
              className={cls}
              title={
                invalidReason ? `No validado (${invalidReason})` : undefined
              }
            >
              <input
                className="npm-vinput"
                value={row.cells[cIdx] ?? ""}
                onChange={(e) =>
                  data.onChangeCell(srcIndex, cIdx, e.target.value)
                }
                disabled={cellDisabled}
              />
            </div>
          );
        })}

        <div className="npm-vcell npm-vcell-colmaster" />
      </div>
    );
  };

  const itemCount = viewIndices ? viewIndices.length : rows.length;

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
                  className={`npm-vhcell npm-vhcell-data ${!colEnabled ? "npm-vhcell-disabled" : ""}`}
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

          <div style={{ width: totalWidth }}>
            <FixedVirtualList<RowData>
              height={LIST_HEIGHT}
              width={totalWidth}
              itemCount={itemCount}
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
          filas con problemas.
        </div>
      ) : null}
    </div>
  );
}

function FixedVirtualList<T>(props: {
  height: number;
  width: number;
  itemCount: number;
  itemSize: number;
  itemData: T;
  overscan?: number;
  children: (p: VirtualRowProps2<T>) => React.ReactNode;
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

/** =========================
 *  Panel reemplazo masivo
 *  ========================= */

export function InvalidBulkReplacePanel(props: {
  groups: InvalidBulkReplaceGroup[];
  disabled?: boolean;
  onReplace: (
    colIndex: number,
    fromValue: string,
    toValue: string,
    rowIndices: number[],
  ) => number;
}) {
  const { groups, disabled, onReplace } = props;

  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setReplacements({});
    setFeedback(null);
  }, [groups.length]);

  if (groups.length === 0) return null;

  return (
    <div className="importModal__groupSection">
      <div className="importModal__groupTitle">
        Reemplazo masivo de celdas inv?lidas
      </div>

      <div className="importModal__groupList">
        {groups.map((item) => {
          const nextValue = replacements[item.id] ?? "";

          return (
            <div key={item.id} className="importModal__groupItem">
              <div className="importModal__groupLabel">
                <span>{item.colLabel}:</span>
                <code>{item.label}</code>
                <span>({item.count} filas)</span>
              </div>

              <div className="importModal__groupActions">
                <input
                  className="importModal__groupInput"
                  value={nextValue}
                  onChange={(e) =>
                    setReplacements((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                  disabled={disabled}
                  placeholder="Nuevo valor"
                />

                <button
                  type="button"
                  className="osm__footerBtn"
                  disabled={disabled || !nextValue.trim()}
                  onClick={() => {
                    const replaced = onReplace(
                      item.colIndex,
                      item.value,
                      nextValue,
                      item.rowIndices,
                    );

                    setFeedback(
                      replaced > 0
                        ? `Reemplazadas ${replaced} celdas de "${item.label}" en ${item.colLabel}.`
                        : "No hubo celdas para reemplazar.",
                    );
                  }}
                >
                  Reemplazar todas
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {feedback ? (
        <div className="importModal__groupFeedback">{feedback}</div>
      ) : null}
    </div>
  );
}

/** =========================
 *  Tabs
 *  ========================= */

export function CapasTab(props: {
  proyectoId: string | null;
  value: string;
  setValue: (v: string) => void;
  isRunning: boolean;
  error: string | null;
}) {
  const { proyectoId, value, setValue, isRunning, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>
        <div style={{ opacity: 0.85 }}>
          Peg? el TXT de capas en el textarea y ejecut? <b>Dry-run</b> o{" "}
          <b>Commit</b>.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">TXT de capas</div>
        <textarea
          className="importModal__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isRunning}
          placeholder="Peg? ac? el contenido TXT..."
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

export function EscenariosTab(props: {
  proyectoId: string | null;
  tipoEscenarioId: string;
  setTipoEscenarioId: (v: string) => void;
  nombreEscenario: string;
  setNombreEscenario: (v: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  importState: any;
  isRunning: boolean;
  error: string | null;
  fieldOptions: Array<{ key: string; label: string }>;
  onLoadContent: (f: File | null) => Promise<void>;
  onChangeMapping: (colIndex: number, mapping: string) => void;
  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;
  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;
  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  onReplaceValue: (
    colIndex: number,
    fromValue: string,
    toValue: string,
    rowIndices: number[],
  ) => number;
  viewMode: ScenarioViewMode;
  setViewMode: (m: ScenarioViewMode) => void;
  report: ScenarioResolveReport | null;
  invalidCells: InvalidCellsMap;
  onDeselectUnresolvedRows: () => void;
  onDeselectMissingPozos: () => void;
  onDeselectMissingCapas: () => void;
  onDeselectRowsByPozoName: (pozoName: string) => void;
  onDeselectRowsByCapaName: (capaName: string) => void;
}) {
  const {
    proyectoId,
    tipoEscenarioId,
    setTipoEscenarioId,
    nombreEscenario,
    setNombreEscenario,
    file,
    setFile,
    importState,
    isRunning,
    error,
    fieldOptions,
    onLoadContent,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    onReplaceValue,
    viewMode,
    setViewMode,
    report,
    invalidCells,
    onDeselectUnresolvedRows,
    onDeselectMissingPozos,
    onDeselectMissingCapas,
    onDeselectRowsByPozoName,
    onDeselectRowsByCapaName,
  } = props;

  const mappingErrs = importState.mappingErrors?.length ?? 0;
  const rowErrs = Object.keys(importState.rowErrors ?? {}).length;

  const unresolvedRowIndices = useMemo(() => {
    if (!report) return [];
    return report.unresolvedRowIndices;
  }, [report]);

  const missingPozosGrouped = useMemo(() => {
    if (!report) return [];
    return groupRowsByLabel(report.missingPozos, (x) => x.pozoName);
  }, [report]);

  const missingCapasGrouped = useMemo(() => {
    if (!report) return [];
    return groupRowsByLabel(report.missingCapas, (x) => x.capaName);
  }, [report]);

  const invalidBulkGroups = useMemo(() => {
    return buildInvalidBulkReplaceGroups(
      importState.rows ?? [],
      importState.columns ?? [],
      invalidCells ?? {},
    );
  }, [importState.rows, importState.columns, invalidCells]);

  const rowIndexMap =
    viewMode === "unresolved" && report ? unresolvedRowIndices : null;

  const onChangeAllRowsView = (sel: boolean) => {
    if (!rowIndexMap) {
      onChangeAllRows(sel);
      return;
    }
    for (const idx of rowIndexMap) {
      onChangeRowSelected(idx, sel);
    }
  };

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>

        <div style={{ opacity: 0.85 }}>
          Tipo <b>{tipoEscenarioId}</b>. En <b>datos</b> se exige Pozo + Capa.
          En <b>historia</b> la capa debe quedar ignorada.
        </div>
      </div>

      {report ? (
        <div
          className="importModal__hint"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
          }}
        >
          {report.ok ? (
            <div>
              ✅ Validación OK: <b>{report.resolved}</b> /{" "}
              <b>{report.totalSelected}</b> filas resueltas.
            </div>
          ) : (
            <div className="importModal__resolveBlock">
              <div>
                ❌ Faltan resolver: <b>{report.resolved}</b> /{" "}
                <b>{report.totalSelected}</b> (unresolved:{" "}
                <b>{report.unresolvedRowIndices.length}</b>)
              </div>

              <div className="importModal__resolveActions">
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("unresolved")}
                >
                  Mostrar solo no resueltas
                </button>

                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("all")}
                >
                  Mostrar todas
                </button>

                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={onDeselectUnresolvedRows}
                >
                  Deseleccionar no resueltas
                </button>

                {report.missingPozos.length > 0 ? (
                  <button
                    type="button"
                    className="osm__footerBtn"
                    onClick={onDeselectMissingPozos}
                  >
                    Deseleccionar pozos faltantes
                  </button>
                ) : null}

                {report.missingCapas.length > 0 ? (
                  <button
                    type="button"
                    className="osm__footerBtn"
                    onClick={onDeselectMissingCapas}
                  >
                    Deseleccionar capas faltantes
                  </button>
                ) : null}
              </div>

              {missingPozosGrouped.length > 0 ? (
                <div className="importModal__groupSection">
                  <div className="importModal__groupTitle">
                    Pozos no encontrados
                  </div>

                  <div className="importModal__groupList">
                    {missingPozosGrouped.map((item) => (
                      <div key={item.label} className="importModal__groupItem">
                        <div className="importModal__groupLabel">
                          <code>{item.label}</code>
                          <span>({item.count} filas)</span>
                        </div>

                        <button
                          type="button"
                          className="osm__footerBtn"
                          onClick={() => onDeselectRowsByPozoName(item.label)}
                        >
                          Deseleccionar esas filas
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {missingCapasGrouped.length > 0 ? (
                <div className="importModal__groupSection">
                  <div className="importModal__groupTitle">
                    Capas no encontradas
                  </div>

                  <div className="importModal__groupList">
                    {missingCapasGrouped.map((item) => (
                      <div key={item.label} className="importModal__groupItem">
                        <div className="importModal__groupLabel">
                          <code>{item.label}</code>
                          <span>({item.count} filas)</span>
                        </div>

                        <button
                          type="button"
                          className="osm__footerBtn"
                          onClick={() => onDeselectRowsByCapaName(item.label)}
                        >
                          Deseleccionar esas filas
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="importModal__hint" style={{ opacity: 0.85 }}>
          Igual que Pozo-Capa: sub? TXT, mape? columnas y ejecut? <b>Dry-run</b>{" "}
          para validar todas las filas contra la DB.
        </div>
      )}

      <InvalidBulkReplacePanel
        groups={invalidBulkGroups}
        disabled={isRunning}
        onReplace={onReplaceValue}
      />

      <div className="importModal__box">
        <div className="importModal__boxTitle">Configuración del escenario</div>

        <div className="importModal__row">
          <div className="importModal__label">Tipo</div>
          <select
            className="importModal__select"
            value={tipoEscenarioId}
            onChange={(e) => setTipoEscenarioId(e.target.value)}
            disabled={isRunning}
          >
            {SCENARIO_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="importModal__row">
          <div className="importModal__label">Nombre</div>
          <input
            className="importModal__input"
            value={nombreEscenario}
            onChange={(e) => setNombreEscenario(e.target.value)}
            disabled={isRunning}
            placeholder="Ej: Datos Marzo 2026"
          />
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Archivo escenario (TXT)</div>
        <input
          className="importModal__file"
          type="file"
          accept=".txt"
          disabled={isRunning}
          onChange={async (e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            try {
              await onLoadContent(f);
            } catch {
              // noop
            }
          }}
        />
        {file ? <div className="importModal__hint">{file.name}</div> : null}
      </div>

      {file ? (
        <ImportMappingTable
          titleLeft={`Filas: ${importState.rows.length}${rowIndexMap ? ` | Mostrando no resueltas: ${rowIndexMap.length}` : ""}`}
          titleRight={`Mapping errs: ${mappingErrs} | Row errs: ${rowErrs}`}
          columns={importState.columns}
          columnUnits={importState.columnUnits}
          selectedCols={importState.selectedCols}
          selectedRows={importState.selectedRows}
          rows={importState.rows}
          mapping={importState.mapping}
          rowErrors={importState.rowErrors}
          mappingErrors={importState.mappingErrors}
          fieldOptions={fieldOptions as any}
          onChangeMapping={onChangeMapping}
          onChangeColSelected={onChangeColSelected}
          onChangeAllCols={onChangeAllCols}
          onChangeRowSelected={onChangeRowSelected}
          onChangeAllRows={onChangeAllRowsView}
          onChangeCell={onChangeCell}
          disabled={isRunning}
          rowIndexMap={rowIndexMap}
          invalidCells={invalidCells}
        />
      ) : null}

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

export function PozoCapaTab(props: {
  proyectoId: string | null;
  file: File | null;
  setFile: (f: File | null) => void;
  importState: any;
  isRunning: boolean;
  error: string | null;

  onLoadContent: (f: File | null) => Promise<void>;

  onChangeMapping: (colIndex: number, mapping: string) => void;
  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;

  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;

  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  onReplaceValue: (
    colIndex: number,
    fromValue: string,
    toValue: string,
    rowIndices: number[],
  ) => number;

  viewMode: PozoCapaViewMode;
  setViewMode: (m: PozoCapaViewMode) => void;
  report: PozoCapaResolveReport | null;

  invalidCells: InvalidCellsMap;
}) {
  const {
    proyectoId,
    file,
    setFile,
    importState,
    isRunning,
    error,
    onLoadContent,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    onReplaceValue,
    viewMode,
    setViewMode,
    report,
    invalidCells,
  } = props;

  const mappingErrs = importState.mappingErrors?.length ?? 0;
  const rowErrs = Object.keys(importState.rowErrors ?? {}).length;

  const unresolvedNameRowIndices = useMemo(() => {
    if (!report) return [];
    const s = new Set<number>();
    for (const x of report.missingPozos ?? []) s.add(x.rowIndex);
    for (const x of report.ambiguousPozos ?? []) s.add(x.rowIndex);
    for (const x of report.missingCapas ?? []) s.add(x.rowIndex);
    for (const x of report.ambiguousCapas ?? []) s.add(x.rowIndex);
    return Array.from(s.values());
  }, [report]);

  const invalidBulkGroups = useMemo(() => {
    return buildInvalidBulkReplaceGroups(
      importState.rows ?? [],
      importState.columns ?? [],
      invalidCells ?? {},
    );
  }, [importState.rows, importState.columns, invalidCells]);

  const rowIndexMap =
    viewMode === "unresolved" && report ? unresolvedNameRowIndices : null;

  const onChangeAllRowsView = (sel: boolean) => {
    if (!rowIndexMap) {
      onChangeAllRows(sel);
      return;
    }
    for (const idx of rowIndexMap) {
      onChangeRowSelected(idx, sel);
    }
  };

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>
        <div style={{ opacity: 0.85 }}>
          Sub? el TXT de Pozo-Capa y mape? columnas (Pozo/Capa/Tope/Base). Pod?s
          excluir filas/columnas.
        </div>
      </div>

      {report ? (
        <div
          className="importModal__hint"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
          }}
        >
          {report.ok ? (
            <div>
              ✅ Validación OK: <b>{report.resolved}</b> /{" "}
              <b>{report.totalSelected}</b> filas resueltas.
            </div>
          ) : (
            <div>
              ❌ Faltan resolver: <b>{report.resolved}</b> /{" "}
              <b>{report.totalSelected}</b> (no resueltas por Pozo/Capa:{" "}
              <b>{unresolvedNameRowIndices.length}</b>)
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("unresolved")}
                >
                  Mostrar solo no resueltas
                </button>
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("all")}
                >
                  Mostrar todas
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="importModal__hint" style={{ opacity: 0.85 }}>
          Ejecut? <b>Dry-run</b> para validar las filas contra la DB y marcar
          celdas inv?lidas.
        </div>
      )}

      <InvalidBulkReplacePanel
        groups={invalidBulkGroups}
        disabled={isRunning}
        onReplace={onReplaceValue}
      />

      <div className="importModal__box">
        <div className="importModal__boxTitle">Archivo Pozo-Capa (TXT)</div>
        <input
          className="importModal__file"
          type="file"
          accept=".txt"
          disabled={isRunning}
          onChange={async (e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            try {
              await onLoadContent(f);
            } catch {
              // noop
            }
          }}
        />
        {file ? <div className="importModal__hint">{file.name}</div> : null}
      </div>

      {file ? (
        <ImportMappingTable
          titleLeft={`Filas: ${importState.rows.length}${rowIndexMap ? ` | Mostrando no resueltas: ${rowIndexMap.length}` : ""}`}
          titleRight={`Mapping errs: ${mappingErrs} | Row errs: ${rowErrs}`}
          columns={importState.columns}
          columnUnits={importState.columnUnits}
          selectedCols={importState.selectedCols}
          selectedRows={importState.selectedRows}
          rows={importState.rows}
          mapping={importState.mapping}
          rowErrors={importState.rowErrors}
          mappingErrors={importState.mappingErrors}
          fieldOptions={POZOCAPA_FIELDS as any}
          onChangeMapping={onChangeMapping}
          onChangeColSelected={onChangeColSelected}
          onChangeAllCols={onChangeAllCols}
          onChangeRowSelected={onChangeRowSelected}
          onChangeAllRows={onChangeAllRowsView}
          onChangeCell={onChangeCell}
          disabled={isRunning}
          rowIndexMap={rowIndexMap}
          invalidCells={invalidCells}
        />
      ) : null}

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

export function SetEstadoPozosTab(props: {
  proyectoId: string | null;
  nombreSetEstadoPozos: string;
  setNombreSetEstadoPozos: (v: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  importState: SetEstadoPozosImportState;
  isRunning: boolean;
  error: string | null;
  onLoadContent: (f: File | null) => Promise<void>;
  onChangeMapping: (colIndex: number, mapping: string) => void;
  onChangeColSelected: (colIndex: number, selected: boolean) => void;
  onChangeAllCols: (selected: boolean) => void;
  onChangeRowSelected: (rowIndex: number, selected: boolean) => void;
  onChangeAllRows: (selected: boolean) => void;
  onChangeCell: (rowIndex: number, colIndex: number, value: string) => void;
  onReplaceValue: (
    colIndex: number,
    fromValue: string,
    toValue: string,
    rowIndices: number[],
  ) => number;
  viewMode: SetEstadoPozosViewMode;
  setViewMode: (m: SetEstadoPozosViewMode) => void;
  report: SetEstadoPozosResolveReport | null;
  invalidCells: InvalidCellsMap;
}) {
  const {
    proyectoId,
    nombreSetEstadoPozos,
    setNombreSetEstadoPozos,
    file,
    setFile,
    importState,
    isRunning,
    error,
    onLoadContent,
    onChangeMapping,
    onChangeColSelected,
    onChangeAllCols,
    onChangeRowSelected,
    onChangeAllRows,
    onChangeCell,
    onReplaceValue,
    viewMode,
    setViewMode,
    report,
    invalidCells,
  } = props;

  const mappingErrs = importState.mappingErrors?.length ?? 0;
  const rowErrs = Object.keys(importState.rowErrors ?? {}).length;

  const unresolvedNameRowIndices = useMemo(() => {
    if (!report) return [];
    const s = new Set<number>();
    for (const x of report.missingPozos ?? []) s.add(x.rowIndex);
    for (const x of report.ambiguousPozos ?? []) s.add(x.rowIndex);
    for (const x of report.missingCapas ?? []) s.add(x.rowIndex);
    for (const x of report.ambiguousCapas ?? []) s.add(x.rowIndex);
    return Array.from(s.values());
  }, [report]);

  const invalidBulkGroups = useMemo(() => {
    return buildInvalidBulkReplaceGroups(
      importState.rows ?? [],
      importState.columns ?? [],
      invalidCells ?? {},
    );
  }, [importState.rows, importState.columns, invalidCells]);

  const rowIndexMap =
    viewMode === "unresolved" && report ? unresolvedNameRowIndices : null;

  const onChangeAllRowsView = (sel: boolean) => {
    if (!rowIndexMap) {
      onChangeAllRows(sel);
      return;
    }
    for (const idx of rowIndexMap) {
      onChangeRowSelected(idx, sel);
    }
  };

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>

        <div style={{ opacity: 0.85 }}>
          Subi un archivo <b>CSV o TXT</b> con columnas <code>pozo</code>,{" "}
          <code>capa</code>, <code>fecha</code> y <code>estado</code>.
        </div>
      </div>

      {report ? (
        <div
          className="importModal__hint"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
          }}
        >
          {report.ok ? (
            <div>
              Validacion OK: <b>{report.resolved}</b> / <b>{report.totalSelected}</b> filas resueltas.
            </div>
          ) : (
            <div>
              Faltan resolver: <b>{report.resolved}</b> / <b>{report.totalSelected}</b> (no resueltas por Pozo/Capa: <b>{unresolvedNameRowIndices.length}</b>)
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("unresolved")}
                >
                  Mostrar solo no resueltas
                </button>
                <button
                  type="button"
                  className="osm__footerBtn"
                  onClick={() => setViewMode("all")}
                >
                  Mostrar todas
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="importModal__hint" style={{ opacity: 0.85 }}>
          Ejecuta <b>Dry-run</b> para validar pozo/capa contra la DB y marcar
          celdas inválidas.
        </div>
      )}

      <InvalidBulkReplacePanel
        groups={invalidBulkGroups}
        disabled={isRunning}
        onReplace={onReplaceValue}
      />

      <div className="importModal__box">
        <div className="importModal__boxTitle">Configuración del set</div>
        <div className="importModal__row">
          <div className="importModal__label">Nombre del set</div>
          <input
            className="importModal__input"
            value={nombreSetEstadoPozos}
            onChange={(e) => setNombreSetEstadoPozos(e.target.value)}
            disabled={isRunning}
            placeholder="Ej: Estado base 1960-1961"
          />
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Archivo Set Estado Pozos (CSV/TXT)</div>
        <input
          className="importModal__file"
          type="file"
          accept=".csv,.txt"
          disabled={isRunning}
          onChange={async (e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            try {
              await onLoadContent(f);
            } catch {
              // noop
            }
          }}
        />
        {file ? <div className="importModal__hint">{file.name}</div> : null}
      </div>

      {file ? (
        <ImportMappingTable
          titleLeft={`Filas: ${importState.rows.length}${rowIndexMap ? ` | Mostrando no resueltas: ${rowIndexMap.length}` : ""}`}
          titleRight={`Mapping errs: ${mappingErrs} | Row errs: ${rowErrs}`}
          columns={importState.columns}
          columnUnits={importState.columnUnits}
          selectedCols={importState.selectedCols}
          selectedRows={importState.selectedRows}
          rows={importState.rows}
          mapping={importState.mapping}
          rowErrors={importState.rowErrors}
          mappingErrors={importState.mappingErrors}
          fieldOptions={SET_ESTADO_POZOS_FIELDS as any}
          onChangeMapping={onChangeMapping}
          onChangeColSelected={onChangeColSelected}
          onChangeAllCols={onChangeAllCols}
          onChangeRowSelected={onChangeRowSelected}
          onChangeAllRows={onChangeAllRowsView}
          onChangeCell={onChangeCell}
          disabled={isRunning}
          rowIndexMap={rowIndexMap}
          invalidCells={invalidCells}
        />
      ) : null}

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

export function MapsTab(props: {
  proyectoId: string | null;
  value: string;
  setValue: (v: string) => void;
  isRunning: boolean;
  error: string | null;
}) {
  const { proyectoId, value, setValue, isRunning, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__hint">
        <div>
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span className="importModal__warn">(no seleccionado)</span>
          )}
        </div>

        <div style={{ opacity: 0.85 }}>
          Peg? un <b>JSON</b> con el payload de Maps.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Payload JSON (Maps)</div>
        <textarea
          className="importModal__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isRunning}
          placeholder={`{
  "rows": [
    { "capaId": "...", "grupoVariableId": "...", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

export function DatabaseTab(props: {
  proyectoId: string | null;
  lastKind: ImportKind;
  lastDryRun: any | null;
  lastCommit: any | null;
  error: string | null;
}) {
  const { proyectoId, lastKind, lastDryRun, lastCommit, error } = props;

  return (
    <div className="importModal__col">
      <div className="importModal__box">
        <div className="importModal__boxTitle">Contexto</div>

        <div className="importModal__p">
          <b>Proyecto:</b>{" "}
          {proyectoId ? (
            <code>{proyectoId}</code>
          ) : (
            <span style={{ opacity: 0.7 }}>(no seleccionado)</span>
          )}
        </div>

        <div className="importModal__p">
          <b>Último tipo:</b> <code>{lastKind}</code>
        </div>
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}

      <div className="importModal__box">
        <div className="importModal__boxTitle">Dry-run</div>
        {lastDryRun ? (
          <pre className="importModal__pre">
            {JSON.stringify(lastDryRun, null, 2)}
          </pre>
        ) : (
          <div className="importModal__hint">
            Todav?a no ejecutaste dry-run.
          </div>
        )}
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Commit</div>
        {lastCommit ? (
          <pre className="importModal__pre">
            {JSON.stringify(lastCommit, null, 2)}
          </pre>
        ) : (
          <div className="importModal__hint">Todav?a no ejecutaste commit.</div>
        )}
      </div>
    </div>
  );
}

export function HelpTab() {
  return (
    <div className="importModal__col">
      <div className="importModal__box">
        <div className="importModal__boxTitle">Capas (TXT)</div>
        <pre className="importModal__pre">{`CAPA
ACU-MO5
MOL-01`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Pozo-Capa (TXT)</div>
        <pre className="importModal__pre">{`POZO\tCAPA\tTOPE\tBASE
PZ-001\tMOL-01\t1234.5\t1301.2
PZ-002\tMOL-01\t1200\t1280`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Escenarios (TXT)</div>
        <pre className="importModal__pre">{`# Datos
pozo capa fecha petroleo agua gas inyeccionAgua
PZ-001 MOL-01 2026-03-01 120 30 15 0
PZ-001 MOL-02 2026-03-01 80 20 10 0`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Maps (JSON payload)</div>
        <pre className="importModal__pre">{`{
  "rows": [
    { "capaId": "...", "grupoVariableId": "...", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}</pre>
      </div>
    </div>
  );
}



