// src/electron/util.ts
import { ipcMain, WebContents, WebFrameMain } from "electron";
import { getUIPath } from "./pathResolver.js";
import { pathToFileURL } from "url";

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

type ElectronApi = Window["electron"];
type ElectronKey = keyof ElectronApi;

type PayloadOf<K extends ElectronKey> = ElectronApi[K] extends (
  payload: infer P,
) => any
  ? P
  : never;

type AwaitedReturnOf<K extends ElectronKey> = ElectronApi[K] extends (
  ...args: any[]
) => Promise<infer R>
  ? R
  : never;

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

export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadMapping[Key],
) {
  if (webContents.isDestroyed()) return;

  try {
    webContents.send(String(key), payload);
  } catch {
    // Renderer can be disposed during reload/navigation. Ignore silently.
  }
}

export function validateEventFrame(frame: WebFrameMain) {
  if (isDev() && new URL(frame.url).host === "localhost:5123") return;
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error("Malicious event");
  }
}
