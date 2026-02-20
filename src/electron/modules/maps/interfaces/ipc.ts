import { ipcMain } from "electron";
import { mapService } from "../application/mapService.js";
import type { UpsertMapInput } from "../domain/map.js";
import { validateEventFrame } from "../../../util.js";

export function registerMapIpcHandlers() {
  ipcMain.handle("mapsGetByLayer", async (event, params: { capaId: string; variableMapaId?: string }) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return mapService.getMapByLayer(params.capaId, params.variableMapaId);
  });

  ipcMain.handle("mapsUpsert", async (event, payload: UpsertMapInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return mapService.upsertMap(payload);
  });
}
