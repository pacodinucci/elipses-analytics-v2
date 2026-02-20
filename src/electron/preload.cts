import electron from "electron";

electron.contextBridge.exposeInMainWorld("electron", {
  subscribeStatistics: (callback) => {
    return ipcOn("statistics", (stats) => {
      callback(stats);
    });
  },
  getStaticData: () => ipcInvoke("getStaticData"),
  backendGetTruthRegistry: () => ipcInvoke("backendGetTruthRegistry"),
  backendInitSchema: () => ipcInvoke("backendInitSchema"),
  backendSeedInitialData: () => ipcInvoke("backendSeedInitialData"),
  backendGetBootstrapStatus: () => ipcInvoke("backendGetBootstrapStatus"),
  mapsGetByLayer: (params) => electron.ipcRenderer.invoke("mapsGetByLayer", params),
  mapsUpsert: (payload) => electron.ipcRenderer.invoke("mapsUpsert", payload),
  legacyVisualizerGetMap: (params) => electron.ipcRenderer.invoke("legacyVisualizerGetMap", params),
  scenarioTypeCreate: (payload) => electron.ipcRenderer.invoke("scenarioTypeCreate", payload),
  scenarioTypeList: () => electron.ipcRenderer.invoke("scenarioTypeList"),
  scenarioCreate: (payload) => electron.ipcRenderer.invoke("scenarioCreate", payload),
  scenarioListByProject: (payload) => electron.ipcRenderer.invoke("scenarioListByProject", payload),
  simulationTypeCreate: (payload) => electron.ipcRenderer.invoke("simulationTypeCreate", payload),
  simulationTypeList: () => electron.ipcRenderer.invoke("simulationTypeList"),
  simulationCreate: (payload) => electron.ipcRenderer.invoke("simulationCreate", payload),
  simulationListByProject: (payload) => electron.ipcRenderer.invoke("simulationListByProject", payload),
  importMapsDryRun: (payload) => electron.ipcRenderer.invoke("importMapsDryRun", payload),
  importMapsCommit: (payload) => electron.ipcRenderer.invoke("importMapsCommit", payload),
  productionCreate: (payload) => electron.ipcRenderer.invoke("productionCreate", payload),
  productionListByProject: (payload) => electron.ipcRenderer.invoke("productionListByProject", payload),
  scenarioValueCreate: (payload) => electron.ipcRenderer.invoke("scenarioValueCreate", payload),
  scenarioValueListByEscenario: (payload) => electron.ipcRenderer.invoke("scenarioValueListByEscenario", payload),
  wellStateTypeCreate: (payload) => electron.ipcRenderer.invoke("wellStateTypeCreate", payload),
  wellStateTypeList: () => electron.ipcRenderer.invoke("wellStateTypeList"),
  wellStateSetCreate: (payload) => electron.ipcRenderer.invoke("wellStateSetCreate", payload),
  wellStateSetListByProject: (payload) => electron.ipcRenderer.invoke("wellStateSetListByProject", payload),
  wellStateSetDetailCreate: (payload) => electron.ipcRenderer.invoke("wellStateSetDetailCreate", payload),
  wellStateSetDetailList: (payload) => electron.ipcRenderer.invoke("wellStateSetDetailList", payload),
  grupoVariableCreate: (payload) => electron.ipcRenderer.invoke("grupoVariableCreate", payload),
  grupoVariableList: () => electron.ipcRenderer.invoke("grupoVariableList"),
  variableCreate: (payload) => electron.ipcRenderer.invoke("variableCreate", payload),
  variableListByUnidades: (payload) => electron.ipcRenderer.invoke("variableListByUnidades", payload),
  ellipseVariableCreate: (payload) => electron.ipcRenderer.invoke("ellipseVariableCreate", payload),
  ellipseVariableList: () => electron.ipcRenderer.invoke("ellipseVariableList"),
  ellipseValueCreate: (payload) => electron.ipcRenderer.invoke("ellipseValueCreate", payload),
  ellipseValueListByProject: (payload) => electron.ipcRenderer.invoke("ellipseValueListByProject", payload),
  variableMapaCreate: (payload) => electron.ipcRenderer.invoke("variableMapaCreate", payload),
  variableMapaList: () => electron.ipcRenderer.invoke("variableMapaList"),
  coreUnidadesCreate: (payload) => electron.ipcRenderer.invoke("coreUnidadesCreate", payload),
  coreUnidadesListByProject: (payload) => electron.ipcRenderer.invoke("coreUnidadesListByProject", payload),
  coreProyectoInitialize: (payload) => electron.ipcRenderer.invoke("coreProyectoInitialize", payload),
  coreProyectoCreate: (payload) => electron.ipcRenderer.invoke("coreProyectoCreate", payload),
  coreProyectoList: () => electron.ipcRenderer.invoke("coreProyectoList"),
  coreCapaCreate: (payload) => electron.ipcRenderer.invoke("coreCapaCreate", payload),
  coreCapaListByProject: (payload) => electron.ipcRenderer.invoke("coreCapaListByProject", payload),
  corePozoCreate: (payload) => electron.ipcRenderer.invoke("corePozoCreate", payload),
  corePozoListByProject: (payload) => electron.ipcRenderer.invoke("corePozoListByProject", payload),
  corePozoCapaCreate: (payload) => electron.ipcRenderer.invoke("corePozoCapaCreate", payload),
  corePozoCapaListByProject: (payload) => electron.ipcRenderer.invoke("corePozoCapaListByProject", payload),
} satisfies Window["electron"]);

function ipcInvoke<Key extends keyof EventPayloadMapping>(
  key: Key
): Promise<EventPayloadMapping[Key]> {
  return electron.ipcRenderer.invoke(key);
}

function ipcOn<Key extends keyof EventPayloadMapping>(
  key: Key,
  callback: (payload: EventPayloadMapping[Key]) => void
) {
  const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload);
  electron.ipcRenderer.on(key, cb);
  return () => electron.ipcRenderer.off(key, cb);
}
