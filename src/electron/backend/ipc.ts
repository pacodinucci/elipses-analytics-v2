import { registerImportIpcHandlers } from "../modules/imports/interfaces/ipc.js";
import { registerCoreDataIpcHandlers } from "../modules/core-data/interfaces/ipc.js";
import { registerScenarioIpcHandlers } from "../modules/scenarios/interfaces/ipc.js";
import { registerSimulationIpcHandlers } from "../modules/simulations/interfaces/ipc.js";
import { registerProductionIpcHandlers } from "../modules/production/interfaces/ipc.js";
import { registerMapIpcHandlers } from "../modules/maps/interfaces/ipc.js";
import { registerScenarioValueIpcHandlers } from "../modules/scenario-values/interfaces/ipc.js";
import { registerWellStatesIpcHandlers } from "../modules/well-states/interfaces/ipc.js";
import { registerVariablesIpcHandlers } from "../modules/variables/interfaces/ipc.js";
import { registerEllipseIpcHandlers } from "../modules/ellipse/interfaces/ipc.js";
import { registerVariableMapaIpcHandlers } from "../modules/variable-mapa/interfaces/ipc.js";
import { ipcMainHandle } from "../util.js";
import { backendStore } from "./store.js";

export function registerBackendIpcHandlers() {
  registerMapIpcHandlers();
  registerScenarioIpcHandlers();
  registerSimulationIpcHandlers();
  registerProductionIpcHandlers();
  registerScenarioValueIpcHandlers();
  registerWellStatesIpcHandlers();
  registerVariablesIpcHandlers();
  registerEllipseIpcHandlers();
  registerVariableMapaIpcHandlers();
  registerImportIpcHandlers();
  registerCoreDataIpcHandlers();
  ipcMainHandle("backendGetTruthRegistry", () => backendStore.getTruthRegistry());
  ipcMainHandle("backendInitSchema", () => backendStore.initSchema());
  ipcMainHandle("backendSeedInitialData", () => backendStore.seedInitialData());
  ipcMainHandle("backendGetBootstrapStatus", () => backendStore.getBootstrapStatus());
}
