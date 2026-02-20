import type { ValorEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";
import { validateCreateValorEscenarioInput } from "../domain/scenarioValue.js";
import { ScenarioValueRepository } from "../infrastructure/scenarioValueRepository.js";

export class ScenarioValueService {
  private readonly repository = new ScenarioValueRepository();
  private schemaReady = false;

  async create(input: CreateValorEscenarioInput): Promise<ValorEscenario> {
    validateCreateValorEscenarioInput(input);
    await this.ensureSchema();
    return this.repository.create(input);
  }

  async listByEscenario(escenarioId: string): Promise<ValorEscenario[]> {
    if (!escenarioId) {
      throw new Error("escenarioId is required");
    }

    await this.ensureSchema();
    return this.repository.listByEscenario(escenarioId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const scenarioValueService = new ScenarioValueService();
