import { ipcMainHandle } from "../util.js";
import { backendStore } from "./store.js";

export function registerBackendIpcHandlers() {
  ipcMainHandle("backendGetTruthRegistry", () => backendStore.getTruthRegistry());
  ipcMainHandle("backendSeedInitialData", () => backendStore.seedInitialData());
  ipcMainHandle("backendGetBootstrapStatus", () => backendStore.getBootstrapStatus());
}
