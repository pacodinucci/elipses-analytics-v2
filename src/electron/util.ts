// src/electron/util.ts
import { ipcMain, WebContents, WebFrameMain } from "electron";
import { getUIPath } from "./pathResolver.js";
import { pathToFileURL } from "url";

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

// ---------------------------
// Tipos auxiliares
// ---------------------------
type ElectronApi = Window["electron"];
type ElectronKey = keyof ElectronApi;

// Obtiene el 1er argumento del método (payload). Si no tiene args -> never
type PayloadOf<K extends ElectronKey> = ElectronApi[K] extends (
  payload: infer P,
) => any
  ? P
  : never;

// Obtiene el tipo de respuesta Promise<T> -> T
type AwaitedReturnOf<K extends ElectronKey> = ElectronApi[K] extends (
  ...args: any[]
) => Promise<infer R>
  ? R
  : never;

// ---------------------------
// IPC helpers
// ---------------------------

export function ipcMainHandle<K extends ElectronKey>(
  key: K,
  handler: () => AwaitedReturnOf<K> | Promise<AwaitedReturnOf<K>>,
) {
  ipcMain.handle(String(key), (event) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return handler();
  });
}

export function ipcMainHandleWithPayload<K extends ElectronKey>(
  key: K,
  handler: (
    payload: PayloadOf<K>,
  ) => AwaitedReturnOf<K> | Promise<AwaitedReturnOf<K>>,
) {
  ipcMain.handle(String(key), (event, payload) => {
    const frame = event.senderFrame;
    if (!frame) throw new Error("Missing senderFrame");
    validateEventFrame(frame);
    return handler(payload as PayloadOf<K>);
  });
}

// ✅ OJO: el tipo en types.d.ts se llama EventPayloadMapping (sin "...ing")
export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadMapping[Key],
) {
  webContents.send(String(key), payload);
}

export function validateEventFrame(frame: WebFrameMain) {
  if (isDev() && new URL(frame.url).host === "localhost:5123") return;
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error("Malicious event");
  }
}
