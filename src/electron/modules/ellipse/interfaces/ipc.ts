// src/electron/modules/ellipse/interfaces/ipc.ts
import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { ellipseService } from "../application/ellipseService.js";
import type {
  CreateElipseInput,
  CreateElipseValorInput,
  CreateElipseVariableInput,
} from "../domain/ellipse.js";

// ✅ NUEVO: payload para normalización
export type ElipsesNormalizationAllPayload = {
  // compat: el hook manda yacimientoId (pero en v2 contiene proyectoId)
  yacimientoId?: string | null;
  // v2 preferido (si lo usás en el futuro)
  proyectoId?: string | null;

  scope: "layer_date" | "layer_all" | "field_date" | "field_all";
  capa?: string | null; // capaNombre
  fecha?: string | null; // YYYY-MM-DD
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
    async (event, payload: { capaId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return ellipseService.listElipsesByLayer(payload.capaId);
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

  // ✅ Normalización (min/max por variable)
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
