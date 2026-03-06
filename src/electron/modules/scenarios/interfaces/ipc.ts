// src/electron/modules/interfaces/ipc.ts
import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { scenarioService } from "../application/scenarioService.js";
import type {
  CreateEscenarioInput,
  CreateTipoEscenarioInput,
} from "../domain/scenario.js";

export function registerScenarioIpcHandlers() {
  ipcMain.handle(
    "scenarioTypeCreate",
    async (event, payload: CreateTipoEscenarioInput) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return scenarioService.createTipoEscenario(payload);
    },
  );

  ipcMain.handle("scenarioTypeList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return scenarioService.listTiposEscenario();
  });

  ipcMain.handle(
    "scenarioCreate",
    async (event, payload: CreateEscenarioInput) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return scenarioService.createEscenario(payload);
    },
  );

  ipcMain.handle(
    "scenarioListByProject",
    async (event, payload: { proyectoId: string }) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return scenarioService.listEscenariosByProyecto(payload.proyectoId);
    },
  );
}
