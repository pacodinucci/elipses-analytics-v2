import electron from "electron";

import type {
  ImportJobResult,
  PozoTxtImportPayload,
  ScenarioTxtImportPayload,
  SetEstadoPozosLargeCommitResult,
  SetEstadoPozosLargeImportPayload,
  SetEstadoPozosLargeProgress,
} from "./modules/imports/domain/importJob.js";

// runtime-only
type Statistics = { cpuUsage: number; ramUsage: number; storageUsage: number };
type StaticData = {
  totalStorage: number;
  cpuModel: string;
  totalMemoryGB: number;
};

// =========================
// ✅ Dynamic Fields Types (preload-local)
// =========================
type DynamicEntity =
  | "Proyecto"
  | "Unidades"
  | "GrupoVariable"
  | "Variable"
  | "Capa"
  | "Pozo"
  | "PozoCapa"
  | "TipoEscenario"
  | "Escenario"
  | "ValorEscenario"
  | "TipoSimulacion"
  | "Simulacion"
  | "TipoEstadoPozo"
  | "SetEstadoPozos"
  | "SetEstadoPozosDetalle"
  | "VariableMapa"
  | "Mapa"
  | "ElipseVariable"
  | "Elipse"
  | "ElipseValor"
  | "import_jobs"
  | "import_job_errors";

type DynamicFieldDataType =
  | "number"
  | "string"
  | "boolean"
  | "date"
  | "enum"
  | "json";

type DynamicFieldsListDefsPayload = { entity: DynamicEntity };

type DynamicFieldsCreateDefPayload = {
  entity: DynamicEntity;
  key: string;
  dataType: DynamicFieldDataType;
  label?: string | null;
  unit?: string | null;
  configJson?: Record<string, unknown> | null;
};

type DynamicFieldsUpdateEntityExtrasPayload = {
  entity: DynamicEntity;
  entityId: string;
  patch: Record<string, unknown>;
  unsetKeys?: string[];
};

electron.contextBridge.exposeInMainWorld("electron", {
  subscribeStatistics: (callback: (stats: Statistics) => void) => {
    return ipcOn<Statistics>("statistics", (stats) => callback(stats));
  },

  getStaticData: () => ipcInvoke<StaticData>("getStaticData"),
  subscribeImportSetEstadoPozosLargeProgress: (
    callback: (progress: SetEstadoPozosLargeProgress) => void,
  ) => {
    return ipcOn<SetEstadoPozosLargeProgress>(
      "importSetEstadoPozosLargeProgress",
      (progress) => callback(progress),
    );
  },


  getPathForFile: (file: unknown) => {
    try {
      const p = electron.webUtils.getPathForFile(file as any);
      const normalized = String(p ?? "").trim();
      return normalized || null;
    } catch {
      return null;
    }
  },

  backendGetTruthRegistry: () =>
    ipcInvoke<BackendTruthRegistry>("backendGetTruthRegistry"),
  backendInitSchema: () =>
    ipcInvoke<BackendBootstrapStatus>("backendInitSchema"),
  backendSeedInitialData: () =>
    ipcInvoke<BackendBootstrapStatus>("backendSeedInitialData"),
  backendGetBootstrapStatus: () =>
    ipcInvoke<BackendBootstrapStatus>("backendGetBootstrapStatus"),

  mapsGetByLayer: (params: unknown) =>
    electron.ipcRenderer.invoke("mapsGetByLayer", params),
  mapsUpsert: (payload: unknown) =>
    electron.ipcRenderer.invoke("mapsUpsert", payload),
  legacyVisualizerGetMap: (params: unknown) =>
    electron.ipcRenderer.invoke("legacyVisualizerGetMap", params),

  scenarioTypeCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("scenarioTypeCreate", payload),
  scenarioTypeList: () => electron.ipcRenderer.invoke("scenarioTypeList"),
  scenarioCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("scenarioCreate", payload),
  scenarioListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("scenarioListByProject", payload),

  simulationTypeCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("simulationTypeCreate", payload),
  simulationTypeList: () => electron.ipcRenderer.invoke("simulationTypeList"),
  simulationCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("simulationCreate", payload),
  simulationListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("simulationListByProject", payload),

  importMapsDryRun: (payload: unknown) =>
    electron.ipcRenderer.invoke("importMapsDryRun", payload),
  importMapsCommit: (payload: unknown) =>
    electron.ipcRenderer.invoke("importMapsCommit", payload),
  importCapasDryRun: (payload: unknown) =>
    electron.ipcRenderer.invoke("importCapasDryRun", payload),
  importCapasCommit: (payload: unknown) =>
    electron.ipcRenderer.invoke("importCapasCommit", payload),

  // ✅ NUEVO: Escenarios (TXT)
  importEscenariosDryRun: (payload: ScenarioTxtImportPayload) =>
    electron.ipcRenderer.invoke(
      "importEscenariosDryRun",
      payload,
    ) as Promise<ImportJobResult>,

  importEscenariosCommit: (payload: ScenarioTxtImportPayload) =>
    electron.ipcRenderer.invoke(
      "importEscenariosCommit",
      payload,
    ) as Promise<ImportJobResult>,

  importSetEstadoPozosLargeCommit: (
    payload: SetEstadoPozosLargeImportPayload,
  ) =>
    electron.ipcRenderer.invoke(
      "importSetEstadoPozosLargeCommit",
      payload,
    ) as Promise<SetEstadoPozosLargeCommitResult>,

    productionCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("productionCreate", payload),
  productionListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("productionListByProject", payload),

  scenarioValueCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("scenarioValueCreate", payload),
  scenarioValueListByEscenario: (payload: unknown) =>
    electron.ipcRenderer.invoke("scenarioValueListByEscenario", payload),

  wellStateTypeCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("wellStateTypeCreate", payload),
  wellStateTypeList: () => electron.ipcRenderer.invoke("wellStateTypeList"),
  wellStateSetCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("wellStateSetCreate", payload),
  wellStateSetListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("wellStateSetListByProject", payload),
  wellStateSetDetailCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("wellStateSetDetailCreate", payload),
  wellStateSetDetailList: (payload: unknown) =>
    electron.ipcRenderer.invoke("wellStateSetDetailList", payload),

  // Variables
  grupoVariableCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("grupoVariableCreate", payload),
  grupoVariableList: (payload?: unknown) =>
    electron.ipcRenderer.invoke("grupoVariableList", payload),
  variableCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("variableCreate", payload),
  variableListByGrupoVariable: (payload: unknown) =>
    electron.ipcRenderer.invoke("variableListByGrupoVariable", payload),
  unidadesListByProyecto: (payload: unknown) =>
    electron.ipcRenderer.invoke("unidadesListByProyecto", payload),
  unidadesUpsert: (payload: unknown) =>
    electron.ipcRenderer.invoke("unidadesUpsert", payload),

  // Ellipse
  ellipseVariableCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("ellipseVariableCreate", payload),
  ellipseVariableList: () => electron.ipcRenderer.invoke("ellipseVariableList"),
  ellipseCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("ellipseCreate", payload),
  ellipseListByLayer: (payload: unknown) =>
    electron.ipcRenderer.invoke("ellipseListByLayer", payload),
  ellipseListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("ellipseListByProject", payload),
  ellipseValueCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("ellipseValueCreate", payload),
  ellipseValueListBySimulacion: (payload: unknown) =>
    electron.ipcRenderer.invoke("ellipseValueListBySimulacion", payload),
  elipsesNormalizationAll: (payload: unknown) =>
    electron.ipcRenderer.invoke("elipsesNormalizationAll", payload),

  // Dynamic Fields
  dynamicFieldsListDefs: (payload: DynamicFieldsListDefsPayload) =>
    electron.ipcRenderer.invoke("dynamicFieldsListDefs", payload),
  dynamicFieldsCreateDef: (payload: DynamicFieldsCreateDefPayload) =>
    electron.ipcRenderer.invoke("dynamicFieldsCreateDef", payload),
  dynamicFieldsUpdateEntityExtras: (
    payload: DynamicFieldsUpdateEntityExtrasPayload,
  ) => electron.ipcRenderer.invoke("dynamicFieldsUpdateEntityExtras", payload),

  // Core Data
  coreProyectoInitialize: (payload: CreateProyectoBootstrapInput) =>
    electron.ipcRenderer.invoke("coreProyectoInitialize", payload) as Promise<{
      proyecto: Proyecto;
    }>,

  coreProyectoRecomputeArealFromPozos: (
    payload: RecomputeProyectoArealFromPozosInput,
  ) =>
    electron.ipcRenderer.invoke(
      "coreProyectoRecomputeArealFromPozos",
      payload,
    ) as Promise<{ proyecto: Proyecto }>,

  coreProyectoCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("coreProyectoCreate", payload),

  coreProyectoList: () =>
    electron.ipcRenderer.invoke("coreProyectoList") as Promise<Proyecto[]>,

  coreCapaCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("coreCapaCreate", payload),
  coreCapaListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("coreCapaListByProject", payload),

  corePozoCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("corePozoCreate", payload),
  corePozoListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("corePozoListByProject", payload),

  corePozoCapaCreate: (payload: unknown) =>
    electron.ipcRenderer.invoke("corePozoCapaCreate", payload),
  corePozoCapaListByProject: (payload: unknown) =>
    electron.ipcRenderer.invoke("corePozoCapaListByProject", payload),

  // ✅ Imports: Pozos (TXT)
  importPozosDryRun: (payload: PozoTxtImportPayload) =>
    electron.ipcRenderer.invoke(
      "importPozosDryRun",
      payload,
    ) as Promise<ImportJobResult>,

  importPozosCommit: (payload: PozoTxtImportPayload) =>
    electron.ipcRenderer.invoke(
      "importPozosCommit",
      payload,
    ) as Promise<ImportJobResult>,
} satisfies Window["electron"]);

// helpers
function ipcInvoke<T>(key: string): Promise<T> {
  return electron.ipcRenderer.invoke(key) as Promise<T>;
}

function ipcOn<T>(key: string, callback: (payload: T) => void) {
  const cb = (_: Electron.IpcRendererEvent, payload: unknown) =>
    callback(payload as T);
  electron.ipcRenderer.on(key, cb);
  return () => electron.ipcRenderer.off(key, cb);
}




