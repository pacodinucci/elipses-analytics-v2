// src/electron/modules/scenario-values/interfaces/ipc.ts
import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { scenarioValueService } from "../application/scenarioValueService.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";

export function registerScenarioValueIpcHandlers() {
  /**
   * ✅ Mantiene el canal por compat ("scenarioValueCreate"),
   * pero la semántica real es UPSERT (por llave compuesta).
   */
  ipcMain.handle(
    "scenarioValueCreate",
    async (event, payload: CreateValorEscenarioInput) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return scenarioValueService.create(payload);
    },
  );

  ipcMain.handle(
    "scenarioValueListByEscenario",
    async (event, payload: { escenarioId: string }) => {
      const frame = event.senderFrame;
      if (!frame) {
        throw new Error("Missing senderFrame");
      }

      validateEventFrame(frame);
      return scenarioValueService.listByEscenario(payload.escenarioId);
    },
  );
}
