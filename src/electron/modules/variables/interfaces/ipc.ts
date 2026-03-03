// src/electron/modules/variables/interfaces/ipc.ts
import { ipcMain } from "electron";

import { validateEventFrame } from "../../../util.js";
import { variablesService } from "../application/variablesService.js";

import type {
  CreateGrupoVariableInput,
  CreateVariableInput,
  UpsertUnidadInput,
} from "../domain/variables.js";

export function registerVariablesIpcHandlers() {
  // ----------------------------
  // GrupoVariable
  // ----------------------------
  ipcMain.handle(
    "grupoVariableCreate",
    async (event, payload: CreateGrupoVariableInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return variablesService.createGrupoVariable(payload);
    },
  );

  ipcMain.handle(
    "grupoVariableList",
    async (event, payload?: { proyectoId?: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return variablesService.listGrupoVariable(payload?.proyectoId);
    },
  );

  // ----------------------------
  // Variable
  // ----------------------------
  ipcMain.handle(
    "variableCreate",
    async (event, payload: CreateVariableInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return variablesService.createVariable(payload);
    },
  );

  ipcMain.handle(
    "variableListByGrupoVariable",
    async (event, payload: { grupoVariableId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return variablesService.listVariableByGrupoVariable(
        payload.grupoVariableId,
      );
    },
  );

  /**
   * ⚠️ LEGACY (rompe explícitamente)
   */
  ipcMain.handle(
    "variableListByUnidades",
    async (event, _payload: { unidadesId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      throw new Error(
        "variableListByUnidades is legacy after unidades_refactor_v9. Use variableListByGrupoVariable + unidadesListByProyecto.",
      );
    },
  );

  // ----------------------------
  // Unidades (settings por proyecto + variable)
  // ----------------------------
  ipcMain.handle(
    "unidadesListByProyecto",
    async (event, payload: { proyectoId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return variablesService.listUnidadesByProyecto(payload.proyectoId);
    },
  );

  ipcMain.handle(
    "unidadesUpsert",
    async (event, payload: UpsertUnidadInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return variablesService.upsertUnidad(payload);
    },
  );
}
