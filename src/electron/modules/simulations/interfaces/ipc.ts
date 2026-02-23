import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { simulationService } from "../application/simulationService.js";
import type {
  CreateSimulacionInput,
  CreateTipoSimulacionInput,
} from "../domain/simulation.js";

export function registerSimulationIpcHandlers() {
  ipcMain.handle(
    "simulationTypeCreate",
    async (event, payload: CreateTipoSimulacionInput) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return simulationService.createTipoSimulacion(payload);
    },
  );

  ipcMain.handle("simulationTypeList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return simulationService.listTiposSimulacion();
  });

  ipcMain.handle(
    "simulationCreate",
    async (event, payload: CreateSimulacionInput) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return simulationService.createSimulacion(payload);
    },
  );

  ipcMain.handle(
    "simulationListByProject",
    async (event, payload: { proyectoId: string }) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return simulationService.listSimulacionesByProyecto(payload.proyectoId);
    },
  );
}
