import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { variablesService } from "../application/variablesService.js";
import type { CreateGrupoVariableInput, CreateVariableInput } from "../domain/variables.js";

export function registerVariablesIpcHandlers() {
  ipcMain.handle("grupoVariableCreate", async (event, payload: CreateGrupoVariableInput) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return variablesService.createGrupoVariable(payload);
  });

  ipcMain.handle("grupoVariableList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return variablesService.listGrupoVariable();
  });

  ipcMain.handle("variableCreate", async (event, payload: CreateVariableInput) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return variablesService.createVariable(payload);
  });

  ipcMain.handle("variableListByUnidades", async (event, payload: { unidadesId: string }) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return variablesService.listVariableByUnidades(payload.unidadesId);
  });
}
