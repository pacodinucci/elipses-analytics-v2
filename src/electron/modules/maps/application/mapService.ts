import type { Mapa } from "../../../backend/models.js";
import { migrations } from "../../../shared/db/migrations.js";
import { databaseService } from "../../../shared/db/index.js";
import { MapRepository } from "../infrastructure/mapRepository.js";
import type { UpsertMapInput } from "../domain/map.js";
import { validateMapInput } from "../domain/map.js";

export class MapService {
  private readonly repository = new MapRepository();
  private schemaReady = false;

  async getMapByLayer(capaId: string, variableMapaId?: string): Promise<Mapa | null> {
    if (!capaId) {
      throw new Error("capaId is required");
    }

    await this.ensureSchema();
    return this.repository.getByLayer(capaId, variableMapaId);
  }

  async upsertMap(input: UpsertMapInput): Promise<Mapa> {
    validateMapInput(input);
    await this.ensureSchema();
    return this.repository.upsert(input);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const mapService = new MapService();
