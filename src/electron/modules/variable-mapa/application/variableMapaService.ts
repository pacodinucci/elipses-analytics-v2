import type { VariableMapa } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateVariableMapaInput } from "../domain/variableMapa.js";
import { validateCreateVariableMapaInput } from "../domain/variableMapa.js";
import { VariableMapaRepository } from "../infrastructure/variableMapaRepository.js";

export class VariableMapaService {
  private readonly repository = new VariableMapaRepository();
  private schemaReady = false;

  async create(input: CreateVariableMapaInput): Promise<VariableMapa> {
    validateCreateVariableMapaInput(input);
    await this.ensureSchema();
    return this.repository.create(input);
  }

  async list(): Promise<VariableMapa[]> {
    await this.ensureSchema();
    return this.repository.list();
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const variableMapaService = new VariableMapaService();
