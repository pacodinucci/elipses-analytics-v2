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
