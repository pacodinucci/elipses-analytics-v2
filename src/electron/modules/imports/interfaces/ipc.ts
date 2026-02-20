import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { importService } from "../application/importService.js";
import type { MapImportPayload } from "../domain/importJob.js";

export function registerImportIpcHandlers() {
  ipcMain.handle("importMapsDryRun", async (event, payload: MapImportPayload) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return importService.dryRunMapImport(payload);
  });

  ipcMain.handle("importMapsCommit", async (event, payload: MapImportPayload) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return importService.commitMapImport(payload);
  });
}
