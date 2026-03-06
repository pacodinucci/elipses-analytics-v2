// src/electron/modules/scenarios/application/scenarioService.ts
import type { Escenario, TipoEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type {
  CreateEscenarioInput,
  CreateTipoEscenarioInput,
} from "../domain/scenario.js";
import {
  validateCreateEscenarioInput,
  validateCreateTipoEscenarioInput,
} from "../domain/scenario.js";
import { ScenarioRepository } from "../infrastructure/scenarioRepository.js";

export class ScenarioService {
  private readonly repository = new ScenarioRepository();
  private schemaReady = false;

  async createTipoEscenario(
    input: CreateTipoEscenarioInput,
  ): Promise<TipoEscenario> {
    validateCreateTipoEscenarioInput(input);
    await this.ensureSchema();
    return this.repository.createTipoEscenario(input);
  }

  async listTiposEscenario(): Promise<TipoEscenario[]> {
    await this.ensureSchema();
    return this.repository.listTiposEscenario();
  }

  async createEscenario(input: CreateEscenarioInput): Promise<Escenario> {
    validateCreateEscenarioInput(input);
    await this.ensureSchema();
    return this.repository.createEscenario(input);
  }

  async listEscenariosByProyecto(proyectoId: string): Promise<Escenario[]> {
    if (!proyectoId) {
      throw new Error("proyectoId is required");
    }

    await this.ensureSchema();
    return this.repository.listEscenariosByProyecto(proyectoId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const scenarioService = new ScenarioService();
