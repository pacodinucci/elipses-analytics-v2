import { app, BrowserWindow } from "electron";
import { ipcMainHandle, isDev } from "./util.js";
import { registerBackendIpcHandlers } from "./backend/ipc.js";
import { backendStore } from "./backend/store.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";

app.on("ready", async () => {
  try {
    registerBackendIpcHandlers();

    const initStatus = await backendStore.initSchema();
    console.log("INIT STATUS:", initStatus);

    const seedStatus = await backendStore.seedInitialData();
    console.log("SEED STATUS:", seedStatus);

    const mainWindow = new BrowserWindow({
      webPreferences: {
        preload: getPreloadPath(),
      },
    });

    if (isDev()) {
      await mainWindow.loadURL("http://localhost:5123");
    } else {
      await mainWindow.loadFile(getUIPath());
    }

    pollResources(mainWindow);

    ipcMainHandle("getStaticData", () => {
      return getStaticData();
    });
  } catch (error) {
    console.error("Error during Electron backend bootstrap:", error);
    app.quit();
  }
});
