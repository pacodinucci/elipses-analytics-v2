// src/components/import/import-modal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  OptionsShellModal,
  type OptionsNavItem,
} from "../mapa/options-shell-modal";
import { TbFileImport, TbDatabase, TbInfoCircle } from "react-icons/tb";
import "./import-modal.css";

import { useSelectionStore } from "../../store/selection-store";
import { invalidateCapasCache } from "../../hooks/use-capas";

// ✅ Reusamos el mismo store del wizard para parse/mapping/selección/virtualización
import { useNewProjectWizardStore } from "../../store/new-project-wizard-store";

// ✅ Helpers (src/ui/lib)
import {
  buildResolverIndex,
  resolvePozoCapaRows,
  type NameEntity,
  type PozoCapaResolveReport,
} from "../../lib/name-resolver";

type TabKey = "capas" | "pozoCapa" | "maps" | "database" | "help";
type ImportKind = "capas" | "pozoCapa" | "maps";

// v2: resultado genérico (no acoplamos types del backend todavía)
type ImportJobResultUI = any;

const POZOCAPA_FIELDS = [
  { key: "pozo", label: "Pozo" },
  { key: "capa", label: "Capa" },
  { key: "tope", label: "Tope" },
  { key: "base", label: "Base" },
] as const;

type PozoCapaViewMode = "all" | "unresolved";

/**
 * invalidCells:
 * key = `${rowIndex}:${colIndex}` (rowIndex real en importState.rows, colIndex real en cells[])
 * value = "missing" | "ambiguous"
 */
type InvalidCellsMap = Record<string, "missing" | "ambiguous">;

export type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const proyectoId = useSelectionStore((s) => s.selectedProyectoId);

  // ✅ store (reutilizamos estados y acciones de import tabular)
  const {
    pozoCapaFile,
    setPozoCapaFile,
    pozoCapaImport,

    setImportFromContent,
    setImportMapping,
    setImportCell,

    setImportRowSelected,
    setImportColSelected,
    setImportAllRowsSelected,
    setImportAllColsSelected,

    validateImport,
    clearImport,
  } = useNewProjectWizardStore();

  const items = useMemo<OptionsNavItem<TabKey>[]>(
    () => [
      {
        key: "capas",
        title: "Capas",
        subtitle: "Import TXT",
        icon: <TbFileImport />,
      },
      {
        key: "pozoCapa",
        title: "Pozo-Capa",
        subtitle: "Import TXT (tabla)",
        icon: <TbFileImport />,
      },
      {
        key: "maps",
        title: "Maps",
        subtitle: "Import rows (JSON)",
        icon: <TbFileImport />,
      },
      {
        key: "database",
        title: "Resultado",
        subtitle: "Último job",
        icon: <TbDatabase />,
      },
      {
        key: "help",
        title: "Ayuda",
        subtitle: "Formato esperado",
        icon: <TbInfoCircle />,
      },
    ],
    [],
  );

  const [activeKey, setActiveKey] = useState<TabKey>("capas");

  // Inputs (capas/maps quedan como estaban)
  const [capasTxt, setCapasTxt] = useState<string>("");
  const [mapsJson, setMapsJson] = useState<string>("");

  // UI state
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [lastKind, setLastKind] = useState<ImportKind>("capas");
  const [lastDryRun, setLastDryRun] = useState<ImportJobResultUI | null>(null);
  const [lastCommit, setLastCommit] = useState<ImportJobResultUI | null>(null);

  // ✅ Pozo-Capa resolve & view mode
  const [pozoCapaViewMode, setPozoCapaViewMode] =
    useState<PozoCapaViewMode>("all");
  const [pozoCapaReport, setPozoCapaReport] =
    useState<PozoCapaResolveReport | null>(null);

  // ✅ celdas inválidas (solo Pozo/Capa missing o ambiguous)
  const [pozoCapaInvalidCells, setPozoCapaInvalidCells] =
    useState<InvalidCellsMap>({});

  useEffect(() => {
    if (!isOpen) return;

    setActiveKey("capas");
    setCapasTxt("");
    setMapsJson("");

    setIsRunning(false);
    setError(null);

    setLastKind("capas");
    setLastDryRun(null);
    setLastCommit(null);

    setPozoCapaViewMode("all");
    setPozoCapaReport(null);
    setPozoCapaInvalidCells({});

    // resetea el tabular de pozo-capa
    setPozoCapaFile(null);
    clearImport("PozoCapa");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ✅ debounce validate para pozo-capa cuando está activo (evita UI lag)
  useEffect(() => {
    if (!isOpen) return;
    if (activeKey !== "pozoCapa") return;
    if (!pozoCapaFile) return;
    const t = window.setTimeout(() => validateImport("PozoCapa"), 160);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    activeKey,
    pozoCapaFile,
    pozoCapaImport.selectedRows,
    pozoCapaImport.selectedCols,
    pozoCapaImport.mapping,
    pozoCapaImport.rows,
    validateImport,
  ]);

  const kind: ImportKind =
    activeKey === "maps"
      ? "maps"
      : activeKey === "pozoCapa"
        ? "pozoCapa"
        : "capas";

  const panelTitle =
    activeKey === "capas"
      ? "Importar Capas"
      : activeKey === "pozoCapa"
        ? "Importar Pozo-Capa"
        : activeKey === "maps"
          ? "Importar Maps"
          : activeKey === "database"
            ? "Resultado"
            : "Ayuda y formato";

  const panelSubtitle =
    activeKey === "capas" ? (
      <>Import TXT de capas (dry-run / commit) por proyecto.</>
    ) : activeKey === "pozoCapa" ? (
      <>
        Import TXT tabular Pozo-Capa (mapeo + selección + tabla virtualizada).
        Dry-run valida TODAS las filas seleccionadas contra la DB (normalización
        alfanumérica). Commit bloquea si queda algo sin resolver.
      </>
    ) : activeKey === "maps" ? (
      <>Import de mapas por filas (pegá JSON del payload) (dry-run / commit).</>
    ) : activeKey === "database" ? (
      <>Últimos resultados del dry-run y del commit.</>
    ) : (
      <>Formato esperado según el tipo de importación.</>
    );

  const canRunCapas = !!proyectoId && !!capasTxt.trim() && !isRunning;
  const canRunMaps = !!proyectoId && !!mapsJson.trim() && !isRunning;

  const pcMappingErrors = pozoCapaImport.mappingErrors?.length ?? 0;
  const pcRowErrors = Object.keys(pozoCapaImport.rowErrors ?? {}).length;

  const canRunPozoCapa =
    !!proyectoId &&
    !!pozoCapaFile &&
    !isRunning &&
    pcMappingErrors === 0 &&
    pcRowErrors === 0;

  const canRun =
    kind === "capas"
      ? canRunCapas
      : kind === "maps"
        ? canRunMaps
        : canRunPozoCapa;

  /**
   * ✅ compute report (valida TODAS las filas seleccionadas, no las visibles)
   * Devolvemos también colPozo/colCapa para poder marcar la celda en rojo.
   */
  const computePozoCapaReportWithCols = async (): Promise<{
    report: PozoCapaResolveReport;
    colPozo: number;
    colCapa: number;
  }> => {
    if (!proyectoId) throw new Error("No hay proyecto seleccionado.");

    const okLocal = validateImport("PozoCapa");
    if (!okLocal) {
      throw new Error(
        "Pozo-Capa: hay errores de mapping o filas inválidas. Corregí antes de validar contra DB.",
      );
    }

    const st = pozoCapaImport;
    const effMapping = st.mapping.map((m: string, i: number) =>
      st.selectedCols[i] ? m : "__ignore__",
    );
    const colPozo = effMapping.findIndex((m: string) => m === "pozo");
    const colCapa = effMapping.findIndex((m: string) => m === "capa");
    const colTope = effMapping.findIndex((m: string) => m === "tope");
    const colBase = effMapping.findIndex((m: string) => m === "base");

    if (colPozo < 0 || colCapa < 0 || colTope < 0 || colBase < 0) {
      throw new Error("Pozo-Capa: mapping incompleto (pozo/capa/tope/base).");
    }

    const [pozos, capas] = await Promise.all([
      window.electron.corePozoListByProject({ proyectoId } as any),
      window.electron.coreCapaListByProject({ proyectoId } as any),
    ]);

    const pozoEntities: NameEntity[] = (pozos ?? []).map((p: any) => ({
      id: String(p.id),
      nombre: String(p.nombre ?? ""),
    }));
    const capaEntities: NameEntity[] = (capas ?? []).map((c: any) => ({
      id: String(c.id),
      nombre: String(c.nombre ?? ""),
    }));

    const pozoIndex = buildResolverIndex(pozoEntities);
    const capaIndex = buildResolverIndex(capaEntities);

    const report = resolvePozoCapaRows({
      rows: st.rows,
      selectedRows: st.selectedRows,
      colPozo,
      colCapa,
      colTope,
      colBase,
      pozoIndex,
      capaIndex,
    });

    return { report, colPozo, colCapa };
  };

  const buildInvalidCellsMap = (
    report: PozoCapaResolveReport,
    colPozo: number,
    colCapa: number,
  ): InvalidCellsMap => {
    const invalid: InvalidCellsMap = {};

    // ✅ SOLO Pozo/Capa (missing o ambiguous)
    for (const x of report.missingPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "missing";
    }
    for (const x of report.ambiguousPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "ambiguous";
    }
    for (const x of report.missingCapas ?? []) {
      invalid[`${x.rowIndex}:${colCapa}`] = "missing";
    }
    for (const x of report.ambiguousCapas ?? []) {
      invalid[`${x.rowIndex}:${colCapa}`] = "ambiguous";
    }

    return invalid;
  };

  const handleDryRun = async () => {
    setError(null);

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastDryRun(null);

      if (kind === "capas") {
        const res = await window.electron.importCapasDryRun({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastDryRun(res);
        setActiveKey("database");
        return;
      }

      if (kind === "maps") {
        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          return;
        }

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsDryRun(payload as any);

        setLastDryRun(res);
        setActiveKey("database");
        return;
      }

      // ✅ Pozo-Capa: dry-run con validación contra DB
      const { report, colPozo, colCapa } =
        await computePozoCapaReportWithCols();
      setPozoCapaReport(report);

      // ✅ marcar celdas inválidas (pozo/capa missing o ambiguous)
      setPozoCapaInvalidCells(buildInvalidCellsMap(report, colPozo, colCapa));

      // si hay fallas, entrá directo a "solo no resueltas"
      if (!report.ok) setPozoCapaViewMode("unresolved");

      const res = {
        status: report.ok ? "ok" : "failed",
        kind: "pozoCapa",
        rowsTotal: pozoCapaImport.rows.length,
        rowsSelected: pozoCapaImport.selectedRows?.filter(Boolean).length ?? 0,
        resolved: report.resolved,
        totalSelected: report.totalSelected,

        // ojo: unresolvedRowIndices puede incluir invalidDepth; igual es un resumen útil
        unresolved: report.unresolvedRowIndices.length,

        missingPozos: report.missingPozos.slice(0, 20),
        missingCapas: report.missingCapas.slice(0, 20),
        ambiguousPozos: report.ambiguousPozos.slice(0, 10),
        ambiguousCapas: report.ambiguousCapas.slice(0, 10),
        invalidDepth: report.invalidDepth.slice(0, 20),
      };

      setLastDryRun(res);
      setActiveKey("database");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleCommit = async () => {
    setError(null);

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastCommit(null);

      if (kind === "capas") {
        const res = await window.electron.importCapasCommit({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastCommit(res);
        invalidateCapasCache(proyectoId);
        setActiveKey("database");
        return;
      }

      if (kind === "maps") {
        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          return;
        }

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsCommit(payload as any);

        setLastCommit(res);
        setActiveKey("database");
        return;
      }

      // ✅ Pozo-Capa: commit SOLO si está todo resuelto
      const { report, colPozo, colCapa } =
        await computePozoCapaReportWithCols();
      setPozoCapaReport(report);
      setPozoCapaInvalidCells(buildInvalidCellsMap(report, colPozo, colCapa));

      if (!report.ok) {
        setPozoCapaViewMode("unresolved");
        throw new Error(
          `Pozo-Capa: NO se puede commitear porque faltan resolver filas. ` +
            `resolved=${report.resolved}/${report.totalSelected}, unresolved=${report.unresolvedRowIndices.length}. ` +
            `Usá "Mostrar solo no resueltas" y corregí manualmente.`,
        );
      }

      let created = 0;
      const errors: string[] = [];

      for (const r of report.rows) {
        try {
          await window.electron.corePozoCapaCreate({
            id: crypto.randomUUID(),
            proyectoId,
            pozoId: r.pozoId,
            capaId: r.capaId,
            tope: r.tope,
            base: r.base,
          } as any);
          created += 1;
        } catch (e) {
          errors.push(
            `Línea ${r.rowNumber}: error creando PozoCapa (${
              e instanceof Error ? e.message : "unknown"
            })`,
          );
        }
      }

      if (errors.length > 0) {
        const head = errors.slice(0, 10).join(" | ");
        throw new Error(`Pozo-Capa: ${errors.length} errores. ${head}`);
      }

      clearImport("PozoCapa");
      setPozoCapaFile(null);
      setPozoCapaViewMode("all");
      setPozoCapaReport(null);
      setPozoCapaInvalidCells({});

      setLastCommit({ status: "ok", kind: "pozoCapa", created });
      setActiveKey("database");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => onClose();

  return (
    <OptionsShellModal<TabKey>
      isOpen={isOpen}
      title="Importar"
      onClose={handleClose}
      items={items}
      activeKey={activeKey}
      onChangeKey={setActiveKey}
      widthClassName="osm__wDefault"
      heightClassName="osm__hDefault"
      sidebarWidthClassName="osm__gridDefault"
      panelTitle={panelTitle}
      panelSubtitle={panelSubtitle}
      footer={
        <div className="importModal__footer">
          <button
            className="osm__footerBtn"
            onClick={handleClose}
            type="button"
          >
            Cerrar
          </button>

          <div style={{ flex: 1 }} />

          {activeKey === "capas" ||
          activeKey === "maps" ||
          activeKey === "pozoCapa" ? (
            <>
              <button
                className="osm__footerBtn"
                onClick={handleDryRun}
                type="button"
                disabled={!canRun}
                title={!proyectoId ? "Seleccioná un proyecto" : undefined}
              >
                {isRunning ? "Ejecutando..." : "Dry-run"}
              </button>

              <button
                className="osm__footerBtn"
                onClick={handleCommit}
                type="button"
                disabled={!canRun}
                title={!proyectoId ? "Seleccioná un proyecto" : undefined}
              >
                {isRunning ? "Ejecutando..." : "Commit"}
              </button>
            </>
          ) : null}
        </div>
      }
    >
      {activeKey === "capas" ? (
        <CapasTab
          proyectoId={proyectoId}
          value={capasTxt}
          setValue={setCapasTxt}
          isRunning={isRunning}
          error={error}
        />
      ) : null}

      {activeKey === "pozoCapa" ? (
        <PozoCapaTab
          proyectoId={proyectoId}
          file={pozoCapaFile}
          setFile={setPozoCapaFile}
          importState={pozoCapaImport}
          isRunning={isRunning}
          error={error}
          onLoadContent={async (f) => {
            if (!f) {
              clearImport("PozoCapa");
              setPozoCapaReport(null);
              setPozoCapaViewMode("all");
              setPozoCapaInvalidCells({});
              return;
            }
            const text = await f.text();
            setImportFromContent("PozoCapa", text);
            setPozoCapaReport(null);
            setPozoCapaViewMode("all");
            setPozoCapaInvalidCells({});
          }}
          onChangeMapping={(col, m) =>
            setImportMapping("PozoCapa", col, m as any)
          }
          onChangeColSelected={(col, sel) =>
            setImportColSelected("PozoCapa", col, sel)
          }
          onChangeAllCols={(sel) => setImportAllColsSelected("PozoCapa", sel)}
          onChangeRowSelected={(row, sel) =>
            setImportRowSelected("PozoCapa", row, sel)
          }
          onChangeAllRows={(sel) => setImportAllRowsSelected("PozoCapa", sel)}
          onChangeCell={(r, c, v) => setImportCell("PozoCapa", r, c, v)}
          viewMode={pozoCapaViewMode}
          setViewMode={setPozoCapaViewMode}
          report={pozoCapaReport}
          invalidCells={pozoCapaInvalidCells}
        />
      ) : null}

      {activeKey === "maps" ? (
        <MapsTab
          proyectoId={proyectoId}
          value={mapsJson}
          setValue={setMapsJson}
          isRunning={isRunning}
          error={error}
        />
      ) : null}

      {activeKey === "database" ? (
        <DatabaseTab
          proyectoId={proyectoId}
          lastKind={lastKind}
          lastDryRun={lastDryRun}
          lastCommit={lastCommit}
          error={error}
        />
      ) : null}

      {activeKey === "help" ? <HelpTab /> : null}
    </OptionsShellModal>
  );
}

function CapasTab(props: {
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
          Pegá el TXT de capas en el textarea y ejecutá <b>Dry-run</b> o{" "}
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
          placeholder="Pegá acá el contenido TXT..."
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function PozoCapaTab(props: {
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

  viewMode: PozoCapaViewMode;
  setViewMode: (m: PozoCapaViewMode) => void;
  report: PozoCapaResolveReport | null;

  // ✅ celdas inválidas
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
    viewMode,
    setViewMode,
    report,
    invalidCells,
  } = props;

  const mappingErrs = importState.mappingErrors?.length ?? 0;
  const rowErrs = Object.keys(importState.rowErrors ?? {}).length;

  // ✅ “unresolved” para el usuario: solo las filas donde falla Pozo o Capa (missing/ambiguous)
  const unresolvedNameRowIndices = useMemo(() => {
    if (!report) return [];
    const s = new Set<number>();
    for (const x of report.missingPozos ?? []) s.add(x.rowIndex);
    for (const x of report.ambiguousPozos ?? []) s.add(x.rowIndex);
    for (const x of report.missingCapas ?? []) s.add(x.rowIndex);
    for (const x of report.ambiguousCapas ?? []) s.add(x.rowIndex);
    return Array.from(s.values());
  }, [report]);

  const rowIndexMap =
    viewMode === "unresolved" && report ? unresolvedNameRowIndices : null;

  const onChangeAllRowsView = (sel: boolean) => {
    if (!rowIndexMap) {
      onChangeAllRows(sel);
      return;
    }
    // seleccionar solo las filas visibles (no resueltas)
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
          Subí el TXT de Pozo-Capa y mapeá columnas (Pozo/Capa/Tope/Base). Podés
          excluir filas/columnas. La tabla está virtualizada.
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
              <b>{report.totalSelected}</b> filas resueltas (todas).
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
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                Tip: corregí las celdas marcadas en rojo y ejecutá{" "}
                <b>Dry-run</b> de nuevo.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="importModal__hint" style={{ opacity: 0.85 }}>
          Tip: ejecutá <b>Dry-run</b> para validar TODAS las filas seleccionadas
          contra la DB y marcar las celdas inválidas.
        </div>
      )}

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

function MapsTab(props: {
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
          Pegá un <b>JSON</b> con el payload de Maps (sin{" "}
          <code>proyectoId</code>). El modal lo agrega automáticamente.
        </div>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Payload JSON (Maps)</div>
        <textarea
          className="importModal__textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isRunning}
          placeholder={`Ejemplo (ajustá a tu MapImportPayload real):
{
  "rows": [
    { "capaId": "…", "grupoVariableId": "…", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}
          spellCheck={false}
        />
      </div>

      {error ? <div className="importModal__error">{error}</div> : null}
    </div>
  );
}

function DatabaseTab(props: {
  proyectoId: string | null;
  lastKind: "capas" | "pozoCapa" | "maps";
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
            Todavía no ejecutaste dry-run.
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
          <div className="importModal__hint">Todavía no ejecutaste commit.</div>
        )}
      </div>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="importModal__col">
      <div className="importModal__box">
        <div className="importModal__boxTitle">Capas (TXT)</div>

        <div className="importModal__p">
          Pegá el TXT completo tal como lo consumen tus importers v2. Ejemplo
          genérico:
        </div>

        <pre className="importModal__pre">{`CAPA\tALIAS\t...
ACU-MO5\tAcuifero Mo5\t...
MOL-01\tMolasa 01\t...`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Pozo-Capa (TXT)</div>

        <div className="importModal__p">
          Debe incluir columnas para <code>Pozo</code>, <code>Capa</code>,{" "}
          <code>Tope</code>, <code>Base</code>. El orden no importa (se mapea
          con select).
        </div>

        <pre className="importModal__pre">{`POZO\tCAPA\tTOPE\tBASE
PZ-001\tMOL-01\t1234.5\t1301.2
PZ-002\tMOL-01\t1200\t1280`}</pre>
      </div>

      <div className="importModal__box">
        <div className="importModal__boxTitle">Maps (JSON payload)</div>

        <div className="importModal__p">
          En v2 el import de maps viene “por filas”. Desde UI lo más estable es
          pegar un JSON con el payload.
        </div>

        <pre className="importModal__pre">{`{
  "rows": [
    { "capaId": "...", "grupoVariableId": "...", "x": 0, "y": 0, "value": 1.23 }
  ]
}`}</pre>
      </div>
    </div>
  );
}

/** ===== Tabla virtualizada (misma base que venías usando, soporta rowIndexMap + invalidCells) ===== */

type VirtualRowProps2<T> = {
  index: number;
  style: React.CSSProperties;
  data: T;
};

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

  // ✅ si está presente, la tabla muestra solo esos índices de rows
  rowIndexMap?: number[] | null;

  // ✅ celdas inválidas (pozo/capa missing/ambiguous)
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
