// src/electron/modules/ellipse/interfaces/ipc.ts
import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { ellipseService } from "../application/ellipseService.js";
import type {
  CreateElipseInput,
  CreateElipseValorInput,
  CreateElipseVariableInput,
} from "../domain/ellipse.js";

export type ElipsesNormalizationAllPayload = {
  yacimientoId?: string | null;
  proyectoId?: string | null;

  scope: "layer_date" | "layer_all" | "field_date" | "field_all";
  capa?: string | null; // capaNombre
  fecha?: string | null; // YYYY-MM-DD

  // ✅ recomendado si querés normalización por simulación (si tu UI lo tiene)
  simulacionId?: string | null;
};

export function registerEllipseIpcHandlers() {
  // =========================
  // ✅ GEOMETRÍA (Elipse)
  // =========================
  ipcMain.handle("ellipseCreate", async (event, payload: CreateElipseInput) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return ellipseService.createElipse(payload);
  });

  ipcMain.handle(
    "ellipseListByLayer",
    async (event, payload: { simulacionId: string; capaId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return ellipseService.listElipsesByLayer(
        payload.simulacionId,
        payload.capaId,
      );
    },
  );

  ipcMain.handle(
    "ellipseListByProject",
    async (event, payload: { proyectoId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return ellipseService.listElipsesByProject(payload.proyectoId);
    },
  );

  // =========================
  // ✅ VARIABLES
  // =========================
  ipcMain.handle(
    "ellipseVariableCreate",
    async (event, payload: CreateElipseVariableInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return ellipseService.createVariable(payload);
    },
  );

  ipcMain.handle("ellipseVariableList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return ellipseService.listVariables();
  });

  // =========================
  // ✅ VALORES
  // =========================
  ipcMain.handle(
    "ellipseValueCreate",
    async (event, payload: CreateElipseValorInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return ellipseService.createValor(payload);
    },
  );

  ipcMain.handle(
    "ellipseValueListBySimulacion",
    async (event, payload: { simulacionId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return ellipseService.listValoresBySimulacion(payload.simulacionId);
    },
  );

  ipcMain.handle(
    "elipsesNormalizationAll",
    async (event, payload: ElipsesNormalizationAllPayload) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return ellipseService.elipsesNormalizationAll(payload);
    },
  );
}
