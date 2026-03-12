import type {
  SetEstadoPozos,
  SetEstadoPozosDetalle,
  TipoEstadoPozo,
} from "../../../backend/models.js";
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

const DEFAULT_WELL_STATE_TYPES = [
  { id: "well-state--1", nombre: "-1", descripcion: "no existe" },
  { id: "well-state-0", nombre: "0", descripcion: "cerrado" },
  { id: "well-state-1", nombre: "1", descripcion: "abierto productor" },
  { id: "well-state-2", nombre: "2", descripcion: "abierto inyector" },
] as const;

export class WellStatesService {
  private readonly repository = new WellStatesRepository();
  private schemaReady = false;

  async createTipoEstadoPozo(
    input: CreateTipoEstadoPozoInput,
  ): Promise<TipoEstadoPozo> {
    validateCreateTipoEstadoPozoInput(input);
    await this.ensureSchema();
    return this.repository.createTipoEstadoPozo(input);
  }

  async listTiposEstadoPozo(): Promise<TipoEstadoPozo[]> {
    await this.ensureSchema();
    return this.repository.listTiposEstadoPozo();
  }

  async createSetEstadoPozos(
    input: CreateSetEstadoPozosInput,
  ): Promise<SetEstadoPozos> {
    validateCreateSetEstadoPozosInput(input);
    await this.ensureSchema();
    return this.repository.createSetEstadoPozos(input);
  }

  async listSetsEstadoPozosByProject(
    proyectoId: string,
  ): Promise<SetEstadoPozos[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listSetsEstadoPozosByProject(proyectoId);
  }

  async createSetEstadoPozosDetalle(
    input: CreateSetEstadoPozosDetalleInput,
  ): Promise<SetEstadoPozosDetalle> {
    validateCreateSetEstadoPozosDetalleInput(input);
    await this.ensureSchema();
    return this.repository.createSetEstadoPozosDetalle(input);
  }

  async listSetEstadoPozosDetalle(
    setEstadoPozosId: string,
  ): Promise<SetEstadoPozosDetalle[]> {
    if (!setEstadoPozosId) throw new Error("setEstadoPozosId is required");
    await this.ensureSchema();
    return this.repository.listSetEstadoPozosDetalle(setEstadoPozosId);
  }

  async ensureDefaultTiposEstadoPozo(): Promise<void> {
    await this.ensureSchema();

    for (const item of DEFAULT_WELL_STATE_TYPES) {
      await databaseService.run(
        `INSERT INTO TipoEstadoPozo (id, nombre, extrasJson)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM TipoEstadoPozo WHERE nombre = ?
         )`,
        [
          item.id,
          item.nombre,
          JSON.stringify({ descripcion: item.descripcion }),
          item.nombre,
        ],
      );
    }
  }
  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const wellStatesService = new WellStatesService();

