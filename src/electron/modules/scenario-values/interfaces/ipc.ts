import { ipcMain } from "electron";
import { validateEventFrame } from "../../../util.js";
import { scenarioValueService } from "../application/scenarioValueService.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";

export function registerScenarioValueIpcHandlers() {
  ipcMain.handle("scenarioValueCreate", async (event, payload: CreateValorEscenarioInput) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return scenarioValueService.create(payload);
  });

  ipcMain.handle("scenarioValueListByEscenario", async (event, payload: { escenarioId: string }) => {
    const frame = event.senderFrame;
    if (!frame) {
      throw new Error("Missing senderFrame");
    }

    validateEventFrame(frame);
    return scenarioValueService.listByEscenario(payload.escenarioId);
  });
}
