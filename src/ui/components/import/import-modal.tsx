import React, { useEffect, useMemo, useState } from "react";
import {
  OptionsShellModal,
  type OptionsNavItem,
} from "../mapa/options-shell-modal";
import { TbFileImport, TbDatabase, TbInfoCircle } from "react-icons/tb";
import "./import-modal.css";

import { useSelectionStore } from "../../store/selection-store";
import { invalidateCapasCache } from "../../hooks/use-capas";

import { useNewProjectWizardStore } from "../../store/new-project-wizard-store";

import {
  buildResolverIndex,
  resolveNameToId,
  resolvePozoCapaRows,
  type NameEntity,
  type PozoCapaResolveReport,
} from "../../lib/name-resolver";

type TabKey =
  | "capas"
  | "pozoCapa"
  | "escenarios"
  | "maps"
  | "database"
  | "help";

type ImportKind = "capas" | "pozoCapa" | "escenarios" | "maps";

type ImportJobResultUI = any;

type ImportProgressPhase =
  | "idle"
  | "preparing"
  | "validating"
  | "dry-run"
  | "committing"
  | "done"
  | "error";

type ImportProgress = {
  visible: boolean;
  kind: ImportKind;
  phase: ImportProgressPhase;
  current: number;
  total: number;
  message: string;
};

const POZOCAPA_FIELDS = [
  { key: "pozo", label: "Pozo" },
  { key: "capa", label: "Capa" },
  { key: "tope", label: "Tope" },
  { key: "base", label: "Base" },
] as const;

const SCENARIO_TYPE_OPTIONS = [
  { id: "historia", nombre: "Historia" },
  { id: "datos", nombre: "Datos" },
  { id: "primaria", nombre: "Primaria" },
  { id: "inyeccion", nombre: "Inyección" },
] as const;

type PozoCapaViewMode = "all" | "unresolved";
type ScenarioViewMode = "all" | "unresolved";

type InvalidCellsMap = Record<string, "missing" | "ambiguous">;

type ScenarioResolvedRow = {
  rowIndex: number;
  rowNumber: number;
  pozoId: string;
  capaId: string | null;
  fecha: string;
  petroleo: number | null;
  agua: number | null;
  gas: number | null;
  inyeccionGas: number | null;
  inyeccionAgua: number | null;
};

type ScenarioResolveReport = {
  ok: boolean;
  totalSelected: number;
  resolved: number;

  missingPozos: Array<{
    rowIndex: number;
    rowNumber: number;
    pozoName: string;
  }>;
  missingCapas: Array<{
    rowIndex: number;
    rowNumber: number;
    capaName: string;
  }>;
  ambiguousPozos: Array<{
    rowIndex: number;
    rowNumber: number;
    pozoName: string;
    candidates: string[];
  }>;
  ambiguousCapas: Array<{
    rowIndex: number;
    rowNumber: number;
    capaName: string;
    candidates: string[];
  }>;
  invalidFechas: Array<{
    rowIndex: number;
    rowNumber: number;
    fecha: string;
  }>;
  missingMetrics: Array<{
    rowIndex: number;
    rowNumber: number;
  }>;
  duplicateLogicalRows: Array<{
    rowIndex: number;
    rowNumber: number;
  }>;

  unresolvedRowIndices: number[];
  rows: ScenarioResolvedRow[];
};

export type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function scenarioFieldOptionsForType(tipoEscenarioId: string) {
  const base = [
    { key: "pozo", label: "Pozo" },
    { key: "fecha", label: "Fecha" },
    { key: "petroleo", label: "Petróleo" },
    { key: "agua", label: "Agua" },
    { key: "gas", label: "Gas" },
    { key: "inyeccionGas", label: "Inyección Gas" },
    { key: "inyeccionAgua", label: "Inyección Agua" },
  ];

  if (tipoEscenarioId === "datos") {
    return [{ key: "capa", label: "Capa" }, ...base];
  }

  return base;
}

function parseNullableMetric(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;

  const [yyyy, mm, dd] = value.split("-").map(Number);
  return (
    d.getUTCFullYear() === yyyy &&
    d.getUTCMonth() + 1 === mm &&
    d.getUTCDate() === dd
  );
}

function normalizeScenarioDate(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (isValidISODate(value)) {
    return value;
  }

  const isoMonthMatch = value.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonthMatch) {
    const year = Number(isoMonthMatch[1]);
    const month = Number(isoMonthMatch[2]);

    if (month >= 1 && month <= 12) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
      return isValidISODate(normalized) ? normalized : null;
    }
  }

  const monthYearMatch = value.match(/^(\d{1,2})-(\d{4})$/);
  if (monthYearMatch) {
    const month = Number(monthYearMatch[1]);
    const year = Number(monthYearMatch[2]);

    if (month >= 1 && month <= 12) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
      return isValidISODate(normalized) ? normalized : null;
    }
  }

  return null;
}

function buildScenarioLogicalKey(
  tipoEscenarioId: string,
  pozoId: string,
  fecha: string,
  capaId: string | null,
): string {
  if (tipoEscenarioId === "historia") {
    return `${pozoId}::__NO_CAPA__::${fecha}`;
  }
  return `${pozoId}::${capaId ?? "__NO_CAPA__"}::${fecha}`;
}

function groupRowsByLabel<T extends { rowIndex: number }>(
  items: T[],
  getLabel: (item: T) => string,
): Array<{ label: string; rowIndices: number[]; count: number }> {
  const map = new Map<string, Set<number>>();

  for (const item of items) {
    const label = getLabel(item).trim() || "(vacío)";
    if (!map.has(label)) map.set(label, new Set<number>());
    map.get(label)!.add(item.rowIndex);
  }

  return Array.from(map.entries())
    .map(([label, indices]) => ({
      label,
      rowIndices: Array.from(indices.values()).sort((a, b) => a - b),
      count: indices.size,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildInitialProgress(kind: ImportKind): ImportProgress {
  return {
    visible: true,
    kind,
    phase: "preparing",
    current: 0,
    total: 0,
    message: "Preparando importación...",
  };
}

function getProgressPercent(progress: ImportProgress | null): number {
  if (!progress || !progress.visible) return 0;
  if (progress.total <= 0) {
    if (progress.phase === "done") return 100;
    return 100;
  }
  return Math.max(
    0,
    Math.min(100, Math.round((progress.current / progress.total) * 100)),
  );
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const proyectoId = useSelectionStore((s) => s.selectedProyectoId);

  const {
    pozoCapaFile,
    setPozoCapaFile,
    pozoCapaImport,

    scenarioFile,
    setScenarioFile,
    scenarioImport,

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
        key: "escenarios",
        title: "Escenarios",
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

  const [capasTxt, setCapasTxt] = useState<string>("");
  const [mapsJson, setMapsJson] = useState<string>("");

  const [scenarioTipoEscenarioId, setScenarioTipoEscenarioId] =
    useState<string>("datos");
  const [scenarioNombre, setScenarioNombre] = useState<string>("");

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastKind, setLastKind] = useState<ImportKind>("capas");
  const [lastDryRun, setLastDryRun] = useState<ImportJobResultUI | null>(null);
  const [lastCommit, setLastCommit] = useState<ImportJobResultUI | null>(null);

  const [pozoCapaViewMode, setPozoCapaViewMode] =
    useState<PozoCapaViewMode>("all");
  const [pozoCapaReport, setPozoCapaReport] =
    useState<PozoCapaResolveReport | null>(null);
  const [pozoCapaInvalidCells, setPozoCapaInvalidCells] =
    useState<InvalidCellsMap>({});

  const [scenarioViewMode, setScenarioViewMode] =
    useState<ScenarioViewMode>("all");
  const [scenarioReport, setScenarioReport] =
    useState<ScenarioResolveReport | null>(null);
  const [scenarioInvalidCells, setScenarioInvalidCells] =
    useState<InvalidCellsMap>({});

  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const resetScenarioResolutionState = () => {
    setScenarioReport(null);
    setScenarioInvalidCells({});
    setScenarioViewMode("all");
  };

  const resetProgressState = () => {
    setProgress(null);
  };

  const updateProgress = (patch: Partial<ImportProgress>) => {
    setProgress((prev) => {
      const base =
        prev ??
        ({
          visible: true,
          kind,
          phase: "preparing",
          current: 0,
          total: 0,
          message: "",
        } satisfies ImportProgress);

      return {
        ...base,
        ...patch,
        visible: patch.visible ?? true,
      };
    });
  };

  const deselectScenarioRows = (rowIndices: number[]) => {
    const unique = Array.from(new Set(rowIndices)).sort((a, b) => a - b);
    for (const rowIndex of unique) {
      setImportRowSelected("Escenario", rowIndex, false);
    }
    resetScenarioResolutionState();
    setError(null);
  };

  useEffect(() => {
    if (!isOpen) return;

    setActiveKey("capas");
    setCapasTxt("");
    setMapsJson("");

    setScenarioTipoEscenarioId("datos");
    setScenarioNombre("");

    setIsRunning(false);
    setError(null);

    setLastKind("capas");
    setLastDryRun(null);
    setLastCommit(null);

    setPozoCapaViewMode("all");
    setPozoCapaReport(null);
    setPozoCapaInvalidCells({});

    resetScenarioResolutionState();
    resetProgressState();

    setPozoCapaFile(null);
    clearImport("PozoCapa");

    setScenarioFile(null);
    clearImport("Escenario");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  useEffect(() => {
    if (!isOpen) return;
    if (activeKey !== "escenarios") return;
    if (!scenarioFile) return;

    const t = window.setTimeout(() => validateImport("Escenario"), 160);
    return () => window.clearTimeout(t);
  }, [
    isOpen,
    activeKey,
    scenarioFile,
    scenarioImport.selectedRows,
    scenarioImport.selectedCols,
    scenarioImport.mapping,
    scenarioImport.rows,
    validateImport,
  ]);

  const kind: ImportKind =
    activeKey === "maps"
      ? "maps"
      : activeKey === "pozoCapa"
        ? "pozoCapa"
        : activeKey === "escenarios"
          ? "escenarios"
          : "capas";

  const panelTitle =
    activeKey === "capas"
      ? "Importar Capas"
      : activeKey === "pozoCapa"
        ? "Importar Pozo-Capa"
        : activeKey === "escenarios"
          ? "Importar Escenarios"
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
        Dry-run valida TODAS las filas seleccionadas contra la DB.
      </>
    ) : activeKey === "escenarios" ? (
      <>
        Misma lógica que Pozo-Capa: TXT tabular, mapping, selección, validación
        contra DB y commit sólo si todas las filas quedan resueltas.
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

  const scMappingErrors = scenarioImport.mappingErrors?.length ?? 0;
  const scRowErrors = Object.keys(scenarioImport.rowErrors ?? {}).length;

  const canRunEscenarios =
    !!proyectoId &&
    !!scenarioFile &&
    !!scenarioNombre.trim() &&
    !isRunning &&
    scMappingErrors === 0 &&
    scRowErrors === 0;

  const canRun =
    kind === "capas"
      ? canRunCapas
      : kind === "maps"
        ? canRunMaps
        : kind === "escenarios"
          ? canRunEscenarios
          : canRunPozoCapa;

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

  const buildPozoCapaInvalidCellsMap = (
    report: PozoCapaResolveReport,
    colPozo: number,
    colCapa: number,
  ): InvalidCellsMap => {
    const invalid: InvalidCellsMap = {};

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

  const computeScenarioReportWithCols = async (): Promise<{
    report: ScenarioResolveReport;
    colPozo: number;
    colCapa: number;
  }> => {
    if (!proyectoId) throw new Error("No hay proyecto seleccionado.");

    const okLocal = validateImport("Escenario");
    if (!okLocal) {
      throw new Error(
        "Escenarios: hay errores de mapping o filas inválidas. Corregí antes de validar contra DB.",
      );
    }

    const st = scenarioImport;
    const effMapping = st.mapping.map((m: string, i: number) =>
      st.selectedCols[i] ? m : "__ignore__",
    );

    const colPozo = effMapping.findIndex((m: string) => m === "pozo");
    const colCapa = effMapping.findIndex((m: string) => m === "capa");
    const colFecha = effMapping.findIndex((m: string) => m === "fecha");
    const colPetroleo = effMapping.findIndex((m: string) => m === "petroleo");
    const colAgua = effMapping.findIndex((m: string) => m === "agua");
    const colGas = effMapping.findIndex((m: string) => m === "gas");
    const colInyGas = effMapping.findIndex((m: string) => m === "inyeccionGas");
    const colInyAgua = effMapping.findIndex(
      (m: string) => m === "inyeccionAgua",
    );

    if (colPozo < 0 || colFecha < 0) {
      throw new Error(
        "Escenarios: mapping incompleto. Se requiere al menos pozo y fecha.",
      );
    }

    if (
      colPetroleo < 0 &&
      colAgua < 0 &&
      colGas < 0 &&
      colInyGas < 0 &&
      colInyAgua < 0
    ) {
      throw new Error(
        "Escenarios: debés mapear al menos una métrica (petroleo/agua/gas/inyeccionGas/inyeccionAgua).",
      );
    }

    if (scenarioTipoEscenarioId === "datos" && colCapa < 0) {
      throw new Error(
        'Escenarios tipo "datos": debés mapear una columna a "capa".',
      );
    }

    if (scenarioTipoEscenarioId === "historia" && colCapa >= 0) {
      throw new Error(
        'Escenarios tipo "historia": la columna "capa" debe quedar ignorada.',
      );
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

    const report: ScenarioResolveReport = {
      ok: true,
      totalSelected: 0,
      resolved: 0,

      missingPozos: [],
      missingCapas: [],
      ambiguousPozos: [],
      ambiguousCapas: [],
      invalidFechas: [],
      missingMetrics: [],
      duplicateLogicalRows: [],

      unresolvedRowIndices: [],
      rows: [],
    };

    const unresolved = new Set<number>();
    const logicalKeys = new Set<string>();

    for (let rowIndex = 0; rowIndex < st.rows.length; rowIndex += 1) {
      if (!st.selectedRows[rowIndex]) continue;

      report.totalSelected += 1;

      const r = st.rows[rowIndex];
      const pozoName = (r.cells[colPozo] ?? "").trim();
      const capaName = colCapa >= 0 ? (r.cells[colCapa] ?? "").trim() : "";
      const fechaRaw = (r.cells[colFecha] ?? "").trim();
      const fecha = normalizeScenarioDate(fechaRaw);

      if (!pozoName) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingPozos.push({
          rowIndex,
          rowNumber: r.rowNumber,
          pozoName: "",
        });
        continue;
      }

      if (scenarioTipoEscenarioId === "datos" && !capaName) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingCapas.push({
          rowIndex,
          rowNumber: r.rowNumber,
          capaName: "",
        });
        continue;
      }

      if (!fecha) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.invalidFechas.push({
          rowIndex,
          rowNumber: r.rowNumber,
          fecha: fechaRaw,
        });
        continue;
      }

      const petroleo =
        colPetroleo >= 0
          ? parseNullableMetric(r.cells[colPetroleo] ?? "")
          : null;
      const agua =
        colAgua >= 0 ? parseNullableMetric(r.cells[colAgua] ?? "") : null;
      const gas =
        colGas >= 0 ? parseNullableMetric(r.cells[colGas] ?? "") : null;
      const inyeccionGas =
        colInyGas >= 0 ? parseNullableMetric(r.cells[colInyGas] ?? "") : null;
      const inyeccionAgua =
        colInyAgua >= 0 ? parseNullableMetric(r.cells[colInyAgua] ?? "") : null;

      const hasAnyMetric =
        petroleo != null ||
        agua != null ||
        gas != null ||
        inyeccionGas != null ||
        inyeccionAgua != null;

      if (!hasAnyMetric) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.missingMetrics.push({
          rowIndex,
          rowNumber: r.rowNumber,
        });
        continue;
      }

      const rp = resolveNameToId(pozoIndex, pozoName);
      if (!rp.ok) {
        report.ok = false;
        unresolved.add(rowIndex);

        if (rp.reason === "missing") {
          report.missingPozos.push({
            rowIndex,
            rowNumber: r.rowNumber,
            pozoName,
          });
        } else {
          report.ambiguousPozos.push({
            rowIndex,
            rowNumber: r.rowNumber,
            pozoName,
            candidates: rp.candidates,
          });
        }
        continue;
      }

      let capaId: string | null = null;

      if (scenarioTipoEscenarioId === "datos") {
        const rc = resolveNameToId(capaIndex, capaName);
        if (!rc.ok) {
          report.ok = false;
          unresolved.add(rowIndex);

          if (rc.reason === "missing") {
            report.missingCapas.push({
              rowIndex,
              rowNumber: r.rowNumber,
              capaName,
            });
          } else {
            report.ambiguousCapas.push({
              rowIndex,
              rowNumber: r.rowNumber,
              capaName,
              candidates: rc.candidates,
            });
          }
          continue;
        }

        capaId = rc.id;
      }

      const logicalKey = buildScenarioLogicalKey(
        scenarioTipoEscenarioId,
        rp.id,
        fecha,
        capaId,
      );

      if (logicalKeys.has(logicalKey)) {
        report.ok = false;
        unresolved.add(rowIndex);
        report.duplicateLogicalRows.push({
          rowIndex,
          rowNumber: r.rowNumber,
        });
        continue;
      }

      logicalKeys.add(logicalKey);

      report.resolved += 1;
      report.rows.push({
        rowIndex,
        rowNumber: r.rowNumber,
        pozoId: rp.id,
        capaId,
        fecha,
        petroleo,
        agua,
        gas,
        inyeccionGas,
        inyeccionAgua,
      });
    }

    report.unresolvedRowIndices = Array.from(unresolved.values());
    return { report, colPozo, colCapa };
  };

  const buildScenarioInvalidCellsMap = (
    report: ScenarioResolveReport,
    colPozo: number,
    colCapa: number,
  ): InvalidCellsMap => {
    const invalid: InvalidCellsMap = {};

    for (const x of report.missingPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "missing";
    }
    for (const x of report.ambiguousPozos ?? []) {
      invalid[`${x.rowIndex}:${colPozo}`] = "ambiguous";
    }

    if (colCapa >= 0) {
      for (const x of report.missingCapas ?? []) {
        invalid[`${x.rowIndex}:${colCapa}`] = "missing";
      }
      for (const x of report.ambiguousCapas ?? []) {
        invalid[`${x.rowIndex}:${colCapa}`] = "ambiguous";
      }
    }

    return invalid;
  };

  const handleDryRun = async () => {
    setError(null);
    setProgress(buildInitialProgress(kind));

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      updateProgress({
        phase: "error",
        message: "No hay proyecto seleccionado.",
      });
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastDryRun(null);

      if (kind === "capas") {
        updateProgress({
          kind,
          phase: "dry-run",
          current: 0,
          total: 0,
          message: "Ejecutando dry-run de capas...",
        });

        const res = await window.electron.importCapasDryRun({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastDryRun(res);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Dry-run de capas finalizado.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "maps") {
        updateProgress({
          kind,
          phase: "preparing",
          current: 0,
          total: 0,
          message: "Validando JSON de maps...",
        });

        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          updateProgress({
            kind,
            phase: "error",
            message: "El JSON de Maps es inválido.",
          });
          return;
        }

        updateProgress({
          kind,
          phase: "dry-run",
          current: 0,
          total: 0,
          message: "Ejecutando dry-run de maps...",
        });

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsDryRun(payload as any);

        setLastDryRun(res);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Dry-run de maps finalizado.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "escenarios") {
        updateProgress({
          kind,
          phase: "validating",
          current: 0,
          total: 0,
          message: "Validando filas de escenario contra la DB...",
        });

        const { report, colPozo, colCapa } =
          await computeScenarioReportWithCols();
        setScenarioReport(report);
        setScenarioInvalidCells(
          buildScenarioInvalidCellsMap(report, colPozo, colCapa),
        );

        if (!report.ok) {
          setScenarioViewMode("unresolved");
          setLastDryRun({
            status: "failed",
            kind: "escenarios",
            rowsTotal: scenarioImport.rows.length,
            rowsSelected:
              scenarioImport.selectedRows?.filter(Boolean).length ?? 0,
            resolved: report.resolved,
            totalSelected: report.totalSelected,
            unresolved: report.unresolvedRowIndices.length,
            missingPozos: report.missingPozos.slice(0, 20),
            missingCapas: report.missingCapas.slice(0, 20),
            ambiguousPozos: report.ambiguousPozos.slice(0, 10),
            ambiguousCapas: report.ambiguousCapas.slice(0, 10),
            invalidFechas: report.invalidFechas.slice(0, 20),
            missingMetrics: report.missingMetrics.slice(0, 20),
            duplicateLogicalRows: report.duplicateLogicalRows.slice(0, 20),
          });
          updateProgress({
            kind,
            phase: "error",
            current: report.resolved,
            total: report.totalSelected,
            message: `Validación con errores: ${report.resolved}/${report.totalSelected} filas resueltas.`,
          });
          setActiveKey("database");
          return;
        }

        updateProgress({
          kind,
          phase: "dry-run",
          current: report.resolved,
          total: report.totalSelected,
          message: "Ejecutando dry-run del escenario...",
        });

        const content = buildContentForCommit("Escenario");
        const res = await window.electron.importEscenariosDryRun({
          proyectoId,
          tipoEscenarioId: scenarioTipoEscenarioId,
          nombreEscenario: scenarioNombre.trim(),
          content,
        });

        setLastDryRun(res);
        updateProgress({
          kind,
          phase: "done",
          current: report.totalSelected,
          total: report.totalSelected,
          message: "Dry-run de escenario finalizado.",
        });
        setActiveKey("database");
        return;
      }

      updateProgress({
        kind,
        phase: "validating",
        current: 0,
        total: 0,
        message: "Resolviendo Pozo/Capa contra la DB...",
      });

      const { report, colPozo, colCapa } =
        await computePozoCapaReportWithCols();
      setPozoCapaReport(report);
      setPozoCapaInvalidCells(
        buildPozoCapaInvalidCellsMap(report, colPozo, colCapa),
      );

      if (!report.ok) setPozoCapaViewMode("unresolved");

      const res = {
        status: report.ok ? "ok" : "failed",
        kind: "pozoCapa",
        rowsTotal: pozoCapaImport.rows.length,
        rowsSelected: pozoCapaImport.selectedRows?.filter(Boolean).length ?? 0,
        resolved: report.resolved,
        totalSelected: report.totalSelected,
        unresolved: report.unresolvedRowIndices.length,
        missingPozos: report.missingPozos.slice(0, 20),
        missingCapas: report.missingCapas.slice(0, 20),
        ambiguousPozos: report.ambiguousPozos.slice(0, 10),
        ambiguousCapas: report.ambiguousCapas.slice(0, 10),
        invalidDepth: report.invalidDepth.slice(0, 20),
      };

      setLastDryRun(res);
      updateProgress({
        kind,
        phase: report.ok ? "done" : "error",
        current: report.resolved,
        total: report.totalSelected,
        message: report.ok
          ? "Dry-run de Pozo-Capa finalizado."
          : `Validación con errores: ${report.resolved}/${report.totalSelected} filas resueltas.`,
      });
      setActiveKey("database");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      updateProgress({
        kind,
        phase: "error",
        message: msg,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCommit = async () => {
    setError(null);
    setProgress(buildInitialProgress(kind));

    if (!proyectoId) {
      setError("No hay proyecto seleccionado.");
      updateProgress({
        phase: "error",
        message: "No hay proyecto seleccionado.",
      });
      return;
    }

    try {
      setIsRunning(true);
      setLastKind(kind);
      setLastCommit(null);

      if (kind === "capas") {
        updateProgress({
          kind,
          phase: "committing",
          current: 0,
          total: 0,
          message: "Importando capas...",
        });

        const res = await window.electron.importCapasCommit({
          proyectoId,
          content: capasTxt,
        } as any);

        setLastCommit(res);
        invalidateCapasCache(proyectoId);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Importación de capas finalizada.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "maps") {
        updateProgress({
          kind,
          phase: "preparing",
          current: 0,
          total: 0,
          message: "Validando JSON de maps...",
        });

        let extra: any;
        try {
          extra = JSON.parse(mapsJson);
        } catch {
          setError("El JSON de Maps es inválido.");
          updateProgress({
            kind,
            phase: "error",
            message: "El JSON de Maps es inválido.",
          });
          return;
        }

        updateProgress({
          kind,
          phase: "committing",
          current: 0,
          total: 0,
          message: "Importando maps...",
        });

        const payload = { proyectoId, ...extra };
        const res = await window.electron.importMapsCommit(payload as any);

        setLastCommit(res);
        updateProgress({
          kind,
          phase: "done",
          current: 1,
          total: 1,
          message: "Importación de maps finalizada.",
        });
        setActiveKey("database");
        return;
      }

      if (kind === "escenarios") {
        updateProgress({
          kind,
          phase: "validating",
          current: 0,
          total: 0,
          message: "Validando filas del escenario...",
        });

        const { report, colPozo, colCapa } =
          await computeScenarioReportWithCols();
        setScenarioReport(report);
        setScenarioInvalidCells(
          buildScenarioInvalidCellsMap(report, colPozo, colCapa),
        );

        if (!report.ok) {
          setScenarioViewMode("unresolved");
          updateProgress({
            kind,
            phase: "error",
            current: report.resolved,
            total: report.totalSelected,
            message: `No se puede commitear: ${report.unresolvedRowIndices.length} filas sin resolver.`,
          });
          throw new Error(
            `Escenarios: NO se puede commitear porque faltan resolver filas. ` +
              `resolved=${report.resolved}/${report.totalSelected}, unresolved=${report.unresolvedRowIndices.length}.`,
          );
        }

        updateProgress({
          kind,
          phase: "committing",
          current: report.resolved,
          total: report.totalSelected,
          message: "Importando escenario...",
        });

        const content = buildContentForCommit("Escenario");

        const res = await window.electron.importEscenariosCommit({
          proyectoId,
          tipoEscenarioId: scenarioTipoEscenarioId,
          nombreEscenario: scenarioNombre.trim(),
          content,
        });

        setLastCommit(res);

        clearImport("Escenario");
        setScenarioFile(null);
        resetScenarioResolutionState();

        updateProgress({
          kind,
          phase: "done",
          current: report.totalSelected,
          total: report.totalSelected,
          message: "Importación del escenario finalizada.",
        });

        setActiveKey("database");
        return;
      }

      updateProgress({
        kind,
        phase: "validating",
        current: 0,
        total: 0,
        message: "Validando Pozo-Capa antes del commit...",
      });

      const { report, colPozo, colCapa } =
        await computePozoCapaReportWithCols();
      setPozoCapaReport(report);
      setPozoCapaInvalidCells(
        buildPozoCapaInvalidCellsMap(report, colPozo, colCapa),
      );

      if (!report.ok) {
        setPozoCapaViewMode("unresolved");
        updateProgress({
          kind,
          phase: "error",
          current: report.resolved,
          total: report.totalSelected,
          message: `No se puede commitear: ${report.unresolvedRowIndices.length} filas sin resolver.`,
        });
        throw new Error(
          `Pozo-Capa: NO se puede commitear porque faltan resolver filas. ` +
            `resolved=${report.resolved}/${report.totalSelected}, unresolved=${report.unresolvedRowIndices.length}.`,
        );
      }

      let created = 0;
      let processed = 0;
      const errors: string[] = [];

      updateProgress({
        kind,
        phase: "committing",
        current: 0,
        total: report.rows.length,
        message: `Creando relaciones Pozo-Capa... 0/${report.rows.length}`,
      });

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
        } finally {
          processed += 1;
          updateProgress({
            kind,
            phase: "committing",
            current: processed,
            total: report.rows.length,
            message: `Creando relaciones Pozo-Capa... ${processed}/${report.rows.length}`,
          });
        }
      }

      if (errors.length > 0) {
        const head = errors.slice(0, 10).join(" | ");
        updateProgress({
          kind,
          phase: "error",
          current: processed,
          total: report.rows.length,
          message: `Pozo-Capa finalizó con ${errors.length} errores.`,
        });
        throw new Error(`Pozo-Capa: ${errors.length} errores. ${head}`);
      }

      clearImport("PozoCapa");
      setPozoCapaFile(null);
      setPozoCapaViewMode("all");
      setPozoCapaReport(null);
      setPozoCapaInvalidCells({});

      setLastCommit({ status: "ok", kind: "pozoCapa", created });
      updateProgress({
        kind,
        phase: "done",
        current: report.rows.length,
        total: report.rows.length,
        message: `Importación Pozo-Capa finalizada. Creados: ${created}.`,
      });
      setActiveKey("database");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      updateProgress({
        kind,
        phase: "error",
        message: msg,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    resetProgressState();
    onClose();
  };

  const scenarioFieldOptions = useMemo(
    () => scenarioFieldOptionsForType(scenarioTipoEscenarioId),
    [scenarioTipoEscenarioId],
  );

  const progressPercent = getProgressPercent(progress);

  return (
    <OptionsShellModal<TabKey>
      isOpen={isOpen}
      title="Importar"
      onClose={handleClose}
      items={items}
      activeKey={activeKey}
      onChangeKey={setActiveKey}
      widthClassName="osm__wFull"
      heightClassName="osm__hFull"
      sidebarWidthClassName="osm__gridFull"
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
          activeKey === "pozoCapa" ||
          activeKey === "escenarios" ? (
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
      {progress?.visible ? (
        <div className="importModal__progress">
          <div className="importModal__progressTop">
            <div className="importModal__progressMessage">
              {progress.message}
            </div>
            <div className="importModal__progressMeta">
              {progress.total > 0
                ? `${progress.current}/${progress.total} · ${progressPercent}%`
                : progress.phase}
            </div>
          </div>

          <div className="importModal__progressBar">
            <div
              className={`importModal__progressFill importModal__progressFill--${progress.phase}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

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

      {activeKey === "escenarios" ? (
        <EscenariosTab
          proyectoId={proyectoId}
          tipoEscenarioId={scenarioTipoEscenarioId}
          setTipoEscenarioId={(next) => {
            setScenarioTipoEscenarioId(next);
            resetScenarioResolutionState();
          }}
          nombreEscenario={scenarioNombre}
          setNombreEscenario={setScenarioNombre}
          file={scenarioFile}
          setFile={setScenarioFile}
          importState={scenarioImport}
          isRunning={isRunning}
          error={error}
          fieldOptions={scenarioFieldOptions}
          onLoadContent={async (f) => {
            if (!f) {
              clearImport("Escenario");
              resetScenarioResolutionState();
              return;
            }
            const text = await f.text();
            setImportFromContent("Escenario", text);
            resetScenarioResolutionState();
          }}
          onChangeMapping={(col, m) =>
            setImportMapping("Escenario", col, m as any)
          }
          onChangeColSelected={(col, sel) =>
            setImportColSelected("Escenario", col, sel)
          }
          onChangeAllCols={(sel) => setImportAllColsSelected("Escenario", sel)}
          onChangeRowSelected={(row, sel) =>
            setImportRowSelected("Escenario", row, sel)
          }
          onChangeAllRows={(sel) => setImportAllRowsSelected("Escenario", sel)}
          onChangeCell={(r, c, v) => setImportCell("Escenario", r, c, v)}
          viewMode={scenarioViewMode}
          setViewMode={setScenarioViewMode}
          report={scenarioReport}
          invalidCells={scenarioInvalidCells}
          onDeselectUnresolvedRows={() => {
            if (!scenarioReport) return;
            deselectScenarioRows(scenarioReport.unresolvedRowIndices);
          }}
          onDeselectMissingPozos={() => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingPozos.map((x) => x.rowIndex),
            );
          }}
          onDeselectMissingCapas={() => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingCapas.map((x) => x.rowIndex),
            );
          }}
          onDeselectRowsByPozoName={(pozoName) => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingPozos
                .filter((x) => x.pozoName === pozoName)
                .map((x) => x.rowIndex),
            );
          }}
          onDeselectRowsByCapaName={(capaName) => {
            if (!scenarioReport) return;
            deselectScenarioRows(
              scenarioReport.missingCapas
                .filter((x) => x.capaName === capaName)
                .map((x) => x.rowIndex),
            );
          }}
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

function EscenariosTab(props: {
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
          Igual que Pozo-Capa: subí TXT, mapeá columnas y ejecutá <b>Dry-run</b>{" "}
          para validar todas las filas contra la DB.
        </div>
      )}

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
          Ejecutá <b>Dry-run</b> para validar las filas contra la DB y marcar
          celdas inválidas.
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
          Pegá un <b>JSON</b> con el payload de Maps.
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

function DatabaseTab(props: {
  proyectoId: string | null;
  lastKind: "capas" | "pozoCapa" | "escenarios" | "maps";
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

/** ===== Tabla virtualizada ===== */

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
