import type { Simulacion, TipoSimulacion } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateSimulacionInput, CreateTipoSimulacionInput } from "../domain/simulation.js";
import {
  validateCreateSimulacionInput,
  validateCreateTipoSimulacionInput,
} from "../domain/simulation.js";
import { SimulationRepository } from "../infrastructure/simulationRepository.js";

export class SimulationService {
  private readonly repository = new SimulationRepository();
  private schemaReady = false;

  async createTipoSimulacion(input: CreateTipoSimulacionInput): Promise<TipoSimulacion> {
    validateCreateTipoSimulacionInput(input);
    await this.ensureSchema();
    return this.repository.createTipoSimulacion(input);
  }

  async listTiposSimulacion(): Promise<TipoSimulacion[]> {
    await this.ensureSchema();
    return this.repository.listTiposSimulacion();
  }

  async createSimulacion(input: CreateSimulacionInput): Promise<Simulacion> {
    validateCreateSimulacionInput(input);
    await this.ensureSchema();
    return this.repository.createSimulacion(input);
  }

  async listSimulacionesByProyecto(proyectoId: string): Promise<Simulacion[]> {
    if (!proyectoId) {
      throw new Error("proyectoId is required");
    }

    await this.ensureSchema();
    return this.repository.listSimulacionesByProyecto(proyectoId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const simulationService = new SimulationService();
