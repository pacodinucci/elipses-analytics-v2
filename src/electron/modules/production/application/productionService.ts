import type { Produccion } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateProduccionInput } from "../domain/production.js";
import { validateCreateProduccionInput } from "../domain/production.js";
import { ProductionRepository } from "../infrastructure/productionRepository.js";

export class ProductionService {
  private readonly repository = new ProductionRepository();
  private schemaReady = false;

  async create(input: CreateProduccionInput): Promise<Produccion> {
    validateCreateProduccionInput(input);
    await this.ensureSchema();
    return this.repository.create(input);
  }

  async listByProject(proyectoId: string): Promise<Produccion[]> {
    if (!proyectoId) {
      throw new Error("proyectoId is required");
    }

    await this.ensureSchema();
    return this.repository.listByProject(proyectoId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const productionService = new ProductionService();
