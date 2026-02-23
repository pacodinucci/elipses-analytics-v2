import { ipcMain } from "electron";
import { mapService } from "../application/mapService.js";
import type { UpsertMapInput } from "../domain/map.js";
import { toLegacyVisualizerMapResponse } from "./legacyAdapter.js";
import { validateEventFrame } from "../../../util.js";

export function registerMapIpcHandlers() {
  ipcMain.handle(
    "mapsGetByLayer",
    async (event, params: { capaId: string }) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return mapService.getMapByLayer(params.capaId);
    },
  );

  ipcMain.handle(
    "legacyVisualizerGetMap",
    async (event, params: { capaId: string }) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      const map = await mapService.getMapByLayer(params.capaId);
      return map ? toLegacyVisualizerMapResponse(map) : null;
    },
  );

  ipcMain.handle("mapsUpsert", async (event, payload: UpsertMapInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return mapService.upsertMap(payload);
  });
}
