import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { productionService } from "../application/productionService.js";
import type { CreateProduccionInput } from "../domain/production.js";

export function registerProductionIpcHandlers() {
  ipcMain.handle("productionCreate", async (event, payload: CreateProduccionInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return productionService.create(payload);
  });

  ipcMain.handle("productionListByProject", async (event, payload: { proyectoId: string }) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return productionService.listByProject(payload.proyectoId);
  });
}
