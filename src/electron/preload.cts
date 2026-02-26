// preload.cts
import electron from "electron";

// ✅ Types locales (sin depender de globals de types.d.ts)
import {
  BackendBootstrapStatus,
  BackendTruthRegistry,
} from "./backend/models.js";

// Estos dos son “runtime-only” en preload; duplicarlos acá es OK.
type Statistics = {
  cpuUsage: number;
  ramUsage: number;
  storageUsage: number;
};

type StaticData = {
  totalStorage: number;
  cpuModel: string;
  totalMemoryGB: number;
};

electron.contextBridge.exposeInMainWorld("electron", {
  subscribeStatistics: (callback) => {
    return ipcOn<Statistics>("statistics", (stats) => {
      callback(stats);
    });
  },

  getStaticData: () => ipcInvoke<StaticData>("getStaticData"),

  backendGetTruthRegistry: () =>
    ipcInvoke<BackendTruthRegistry>("backendGetTruthRegistry"),
  backendInitSchema: () =>
    ipcInvoke<BackendBootstrapStatus>("backendInitSchema"),
  backendSeedInitialData: () =>
    ipcInvoke<BackendBootstrapStatus>("backendSeedInitialData"),
  backendGetBootstrapStatus: () =>
    ipcInvoke<BackendBootstrapStatus>("backendGetBootstrapStatus"),

  mapsGetByLayer: (params) =>
    electron.ipcRenderer.invoke("mapsGetByLayer", params),
  mapsUpsert: (payload) => electron.ipcRenderer.invoke("mapsUpsert", payload),
  legacyVisualizerGetMap: (params) =>
    electron.ipcRenderer.invoke("legacyVisualizerGetMap", params),

  scenarioTypeCreate: (payload) =>
    electron.ipcRenderer.invoke("scenarioTypeCreate", payload),
  scenarioTypeList: () => electron.ipcRenderer.invoke("scenarioTypeList"),
  scenarioCreate: (payload) =>
    electron.ipcRenderer.invoke("scenarioCreate", payload),
  scenarioListByProject: (payload) =>
    electron.ipcRenderer.invoke("scenarioListByProject", payload),

  simulationTypeCreate: (payload) =>
    electron.ipcRenderer.invoke("simulationTypeCreate", payload),
  simulationTypeList: () => electron.ipcRenderer.invoke("simulationTypeList"),
  simulationCreate: (payload) =>
    electron.ipcRenderer.invoke("simulationCreate", payload),
  simulationListByProject: (payload) =>
    electron.ipcRenderer.invoke("simulationListByProject", payload),

  importMapsDryRun: (payload) =>
    electron.ipcRenderer.invoke("importMapsDryRun", payload),
  importMapsCommit: (payload) =>
    electron.ipcRenderer.invoke("importMapsCommit", payload),
  importCapasDryRun: (payload) =>
    electron.ipcRenderer.invoke("importCapasDryRun", payload),
  importCapasCommit: (payload) =>
    electron.ipcRenderer.invoke("importCapasCommit", payload),

  productionCreate: (payload) =>
    electron.ipcRenderer.invoke("productionCreate", payload),
  productionListByProject: (payload) =>
    electron.ipcRenderer.invoke("productionListByProject", payload),

  scenarioValueCreate: (payload) =>
    electron.ipcRenderer.invoke("scenarioValueCreate", payload),
  scenarioValueListByEscenario: (payload) =>
    electron.ipcRenderer.invoke("scenarioValueListByEscenario", payload),

  wellStateTypeCreate: (payload) =>
    electron.ipcRenderer.invoke("wellStateTypeCreate", payload),
  wellStateTypeList: () => electron.ipcRenderer.invoke("wellStateTypeList"),
  wellStateSetCreate: (payload) =>
    electron.ipcRenderer.invoke("wellStateSetCreate", payload),
  wellStateSetListByProject: (payload) =>
    electron.ipcRenderer.invoke("wellStateSetListByProject", payload),
  wellStateSetDetailCreate: (payload) =>
    electron.ipcRenderer.invoke("wellStateSetDetailCreate", payload),
  wellStateSetDetailList: (payload) =>
    electron.ipcRenderer.invoke("wellStateSetDetailList", payload),

  grupoVariableCreate: (payload) =>
    electron.ipcRenderer.invoke("grupoVariableCreate", payload),
  grupoVariableList: () => electron.ipcRenderer.invoke("grupoVariableList"),

  variableCreate: (payload) =>
    electron.ipcRenderer.invoke("variableCreate", payload),
  variableListByUnidades: (payload) =>
    electron.ipcRenderer.invoke("variableListByUnidades", payload),

  // =========================
  // ✅ Ellipse (variables / geometría / valores / normalización)
  // =========================
  ellipseVariableCreate: (payload) =>
    electron.ipcRenderer.invoke("ellipseVariableCreate", payload),
  ellipseVariableList: () => electron.ipcRenderer.invoke("ellipseVariableList"),

  ellipseCreate: (payload) =>
    electron.ipcRenderer.invoke("ellipseCreate", payload),
  ellipseListByLayer: (payload) =>
    electron.ipcRenderer.invoke("ellipseListByLayer", payload),
  ellipseListByProject: (payload) =>
    electron.ipcRenderer.invoke("ellipseListByProject", payload),

  ellipseValueCreate: (payload) =>
    electron.ipcRenderer.invoke("ellipseValueCreate", payload),
  ellipseValueListBySimulacion: (payload) =>
    electron.ipcRenderer.invoke("ellipseValueListBySimulacion", payload),

  elipsesNormalizationAll: (payload) =>
    electron.ipcRenderer.invoke("elipsesNormalizationAll", payload),

  // =========================
  // Legacy variable-mapa
  // =========================
  variableMapaCreate: (payload) =>
    electron.ipcRenderer.invoke("variableMapaCreate", payload),
  variableMapaList: () => electron.ipcRenderer.invoke("variableMapaList"),

  // =========================
  // Core Data
  // =========================
  coreUnidadesCreate: (payload) =>
    electron.ipcRenderer.invoke("coreUnidadesCreate", payload),
  coreUnidadesListByProject: (payload) =>
    electron.ipcRenderer.invoke("coreUnidadesListByProject", payload),

  coreProyectoInitialize: (payload) =>
    electron.ipcRenderer.invoke("coreProyectoInitialize", payload),
  coreProyectoCreate: (payload) =>
    electron.ipcRenderer.invoke("coreProyectoCreate", payload),
  coreProyectoList: () => electron.ipcRenderer.invoke("coreProyectoList"),

  coreCapaCreate: (payload) =>
    electron.ipcRenderer.invoke("coreCapaCreate", payload),
  coreCapaListByProject: (payload) =>
    electron.ipcRenderer.invoke("coreCapaListByProject", payload),

  corePozoCreate: (payload) =>
    electron.ipcRenderer.invoke("corePozoCreate", payload),
  corePozoListByProject: (payload) =>
    electron.ipcRenderer.invoke("corePozoListByProject", payload),

  corePozoCapaCreate: (payload) =>
    electron.ipcRenderer.invoke("corePozoCapaCreate", payload),
  corePozoCapaListByProject: (payload) =>
    electron.ipcRenderer.invoke("corePozoCapaListByProject", payload),

  // 👇 si lo querés expuesto también por typing rápido (no cambia runtime)
  // legacyVisualizerGetMap already above; type-only import is here to help TS
} satisfies Window["electron"]);

// ✅ Helpers genéricos por tipo (sin depender de globals)
function ipcInvoke<T>(key: string): Promise<T> {
  return electron.ipcRenderer.invoke(key) as Promise<T>;
}

function ipcOn<T>(key: string, callback: (payload: T) => void) {
  const cb = (_: Electron.IpcRendererEvent, payload: unknown) =>
    callback(payload as T);
  electron.ipcRenderer.on(key, cb);
  return () => electron.ipcRenderer.off(key, cb);
}
