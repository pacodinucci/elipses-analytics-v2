import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { wellStatesService } from "../application/wellStatesService.js";
import type {
  CreateSetEstadoPozosDetalleInput,
  CreateSetEstadoPozosInput,
  CreateTipoEstadoPozoInput,
} from "../domain/wellStates.js";

export function registerWellStatesIpcHandlers() {
  ipcMain.handle(
    "wellStateTypeCreate",
    async (event, payload: CreateTipoEstadoPozoInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return wellStatesService.createTipoEstadoPozo(payload);
    },
  );

  ipcMain.handle("wellStateTypeList", async (event) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return wellStatesService.listTiposEstadoPozo();
  });

  ipcMain.handle(
    "wellStateSetCreate",
    async (event, payload: CreateSetEstadoPozosInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return wellStatesService.createSetEstadoPozos(payload);
    },
  );

  ipcMain.handle(
    "wellStateSetListByProject",
    async (event, payload: { proyectoId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return wellStatesService.listSetsEstadoPozosByProject(payload.proyectoId);
    },
  );

  ipcMain.handle(
    "wellStateSetDetailCreate",
    async (event, payload: CreateSetEstadoPozosDetalleInput) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return wellStatesService.createSetEstadoPozosDetalle(payload);
    },
  );

  ipcMain.handle(
    "wellStateSetDetailList",
    async (event, payload: { setEstadoPozosId: string }) => {
      const frame = event.senderFrame;
      if (!frame) throw new Error("Missing senderFrame");
      validateEventFrame(frame);
      return wellStatesService.listSetEstadoPozosDetalle(
        payload.setEstadoPozosId,
      );
    },
  );
}
