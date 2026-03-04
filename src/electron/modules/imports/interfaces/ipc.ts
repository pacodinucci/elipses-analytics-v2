// src/electron/modules/imports/interfaces/ipc.ts
import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { importService } from "../application/importService.js";
import type {
  CapaTxtImportPayload,
  MapImportPayload,
  PozoTxtImportPayload,
} from "../domain/importJob.js";

function validateIpcEvent(event: Electron.IpcMainInvokeEvent) {
  const frame = event.senderFrame;
  if (!frame) throw new Error("Missing senderFrame");
  validateEventFrame(frame);
}

export function registerImportIpcHandlers() {
  ipcMain.handle(
    "importMapsDryRun",
    async (event, payload: MapImportPayload) => {
      validateIpcEvent(event);
      return importService.dryRunMapImport(payload);
    },
  );

  ipcMain.handle(
    "importMapsCommit",
    async (event, payload: MapImportPayload) => {
      validateIpcEvent(event);
      return importService.commitMapImport(payload);
    },
  );

  ipcMain.handle(
    "importCapasDryRun",
    async (event, payload: CapaTxtImportPayload) => {
      validateIpcEvent(event);
      return importService.dryRunCapaTxtImport(payload);
    },
  );

  ipcMain.handle(
    "importCapasCommit",
    async (event, payload: CapaTxtImportPayload) => {
      validateIpcEvent(event);
      return importService.commitCapaTxtImport(payload);
    },
  );

  // ✅ Pozos (TXT)
  ipcMain.handle(
    "importPozosDryRun",
    async (event, payload: PozoTxtImportPayload) => {
      validateIpcEvent(event);
      return importService.dryRunPozoTxtImport(payload);
    },
  );

  ipcMain.handle(
    "importPozosCommit",
    async (event, payload: PozoTxtImportPayload) => {
      validateIpcEvent(event);
      return importService.commitPozoTxtImport(payload);
    },
  );
}
