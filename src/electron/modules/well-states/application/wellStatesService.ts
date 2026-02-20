import type { SetEstadoPozos, SetEstadoPozosDetalle, TipoEstadoPozo } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type {
  CreateSetEstadoPozosDetalleInput,
  CreateSetEstadoPozosInput,
  CreateTipoEstadoPozoInput,
} from "../domain/wellStates.js";
import {
  validateCreateSetEstadoPozosDetalleInput,
  validateCreateSetEstadoPozosInput,
  validateCreateTipoEstadoPozoInput,
} from "../domain/wellStates.js";
import { WellStatesRepository } from "../infrastructure/wellStatesRepository.js";

export class WellStatesService {
  private readonly repository = new WellStatesRepository();
  private schemaReady = false;

  async createTipoEstadoPozo(input: CreateTipoEstadoPozoInput): Promise<TipoEstadoPozo> {
    validateCreateTipoEstadoPozoInput(input);
    await this.ensureSchema();
    return this.repository.createTipoEstadoPozo(input);
  }

  async listTiposEstadoPozo(): Promise<TipoEstadoPozo[]> {
    await this.ensureSchema();
    return this.repository.listTiposEstadoPozo();
  }

  async createSetEstadoPozos(input: CreateSetEstadoPozosInput): Promise<SetEstadoPozos> {
    validateCreateSetEstadoPozosInput(input);
    await this.ensureSchema();
    return this.repository.createSetEstadoPozos(input);
  }

  async listSetsEstadoPozosByProject(proyectoId: string): Promise<SetEstadoPozos[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listSetsEstadoPozosByProject(proyectoId);
  }

  async createSetEstadoPozosDetalle(input: CreateSetEstadoPozosDetalleInput): Promise<SetEstadoPozosDetalle> {
    validateCreateSetEstadoPozosDetalleInput(input);
    await this.ensureSchema();
    return this.repository.createSetEstadoPozosDetalle(input);
  }

  async listSetEstadoPozosDetalle(setEstadoPozosId: string): Promise<SetEstadoPozosDetalle[]> {
    if (!setEstadoPozosId) throw new Error("setEstadoPozosId is required");
    await this.ensureSchema();
    return this.repository.listSetEstadoPozosDetalle(setEstadoPozosId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const wellStatesService = new WellStatesService();
