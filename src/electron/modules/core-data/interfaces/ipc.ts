import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { coreDataService } from "../application/coreDataService.js";
import type {
  CreateCapaInput,
  CreatePozoCapaInput,
  CreatePozoInput,
  CreateProyectoBootstrapInput,
  CreateProyectoInput,
  CreateUnidadesInput,
} from "../domain/coreData.js";

export function registerCoreDataIpcHandlers() {
  ipcMain.handle("coreUnidadesCreate", async (event, payload: CreateUnidadesInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.createUnidades(payload);
  });

  ipcMain.handle("coreUnidadesListByProject", async (event, payload: { proyectoId: string }) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.listUnidadesByProject(payload.proyectoId);
  });


  ipcMain.handle("coreProyectoInitialize", async (event, payload: CreateProyectoBootstrapInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.initializeProyecto(payload);
  });

  ipcMain.handle("coreProyectoCreate", async (event, payload: CreateProyectoInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.createProyecto(payload);
  });

  ipcMain.handle("coreProyectoList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.listProyectos();
  });

  ipcMain.handle("coreCapaCreate", async (event, payload: CreateCapaInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.createCapa(payload);
  });

  ipcMain.handle("coreCapaListByProject", async (event, payload: { proyectoId: string }) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.listCapasByProject(payload.proyectoId);
  });

  ipcMain.handle("corePozoCreate", async (event, payload: CreatePozoInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.createPozo(payload);
  });

  ipcMain.handle("corePozoListByProject", async (event, payload: { proyectoId: string }) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.listPozosByProject(payload.proyectoId);
  });

  ipcMain.handle("corePozoCapaCreate", async (event, payload: CreatePozoCapaInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.createPozoCapa(payload);
  });

  ipcMain.handle("corePozoCapaListByProject", async (event, payload: { proyectoId: string }) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return coreDataService.listPozoCapaByProject(payload.proyectoId);
  });
}
