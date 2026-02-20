import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { variableMapaService } from "../application/variableMapaService.js";
import type { CreateVariableMapaInput } from "../domain/variableMapa.js";

export function registerVariableMapaIpcHandlers() {
  ipcMain.handle("variableMapaCreate", async (event, payload: CreateVariableMapaInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return variableMapaService.create(payload);
  });

  ipcMain.handle("variableMapaList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return variableMapaService.list();
  });
}
