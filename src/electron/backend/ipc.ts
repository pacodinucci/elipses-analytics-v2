import { registerImportIpcHandlers } from "../modules/imports/interfaces/ipc.js";
import { registerCoreDataIpcHandlers } from "../modules/core-data/interfaces/ipc.js";
import { registerScenarioIpcHandlers } from "../modules/scenarios/interfaces/ipc.js";
import { registerSimulationIpcHandlers } from "../modules/simulations/interfaces/ipc.js";
import { registerProductionIpcHandlers } from "../modules/production/interfaces/ipc.js";
import { registerMapIpcHandlers } from "../modules/maps/interfaces/ipc.js";
import { ipcMainHandle } from "../util.js";
import { backendStore } from "./store.js";

export function registerBackendIpcHandlers() {
  registerMapIpcHandlers();
  registerScenarioIpcHandlers();
  registerSimulationIpcHandlers();
  registerProductionIpcHandlers();
  registerImportIpcHandlers();
  registerCoreDataIpcHandlers();
  ipcMainHandle("backendGetTruthRegistry", () => backendStore.getTruthRegistry());
  ipcMainHandle("backendInitSchema", () => backendStore.initSchema());
  ipcMainHandle("backendSeedInitialData", () => backendStore.seedInitialData());
  ipcMainHandle("backendGetBootstrapStatus", () => backendStore.getBootstrapStatus());
}
