import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { ellipseService } from "../application/ellipseService.js";
import type { CreateElipseValorInput, CreateElipseVariableInput } from "../domain/ellipse.js";

export function registerEllipseIpcHandlers() {
  ipcMain.handle("ellipseVariableCreate", async (event, payload: CreateElipseVariableInput) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return ellipseService.createVariable(payload);
  });

  ipcMain.handle("ellipseVariableList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return ellipseService.listVariables();
  });

  ipcMain.handle("ellipseValueCreate", async (event, payload: CreateElipseValorInput) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return ellipseService.createValor(payload);
  });

  ipcMain.handle("ellipseValueListByProject", async (event, payload: { proyectoId: string }) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return ellipseService.listValoresByProject(payload.proyectoId);
  });
}
