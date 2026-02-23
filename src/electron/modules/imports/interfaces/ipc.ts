import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { importService } from "../application/importService.js";
import type { CapaTxtImportPayload, MapImportPayload } from "../domain/importJob.js";

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

  ipcMain.handle("importCapasDryRun", async (event, payload: CapaTxtImportPayload) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return importService.dryRunCapaTxtImport(payload);
  });

  ipcMain.handle("importCapasCommit", async (event, payload: CapaTxtImportPayload) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return importService.commitCapaTxtImport(payload);
  });

}
