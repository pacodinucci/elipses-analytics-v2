// src/electron/modules/core-data/application/coreDataService.ts
import { randomUUID } from "node:crypto";

import type {
  Capa,
  Pozo,
  PozoCapa,
  Proyecto,
} from "../../../backend/models.js";
import { migrations } from "../../../shared/db/migrations.js";
import { databaseService } from "../../../shared/db/index.js";

import type {
  CreateCapaInput,
  CreatePozoCapaInput,
  CreatePozoInput,
  CreateProyectoBootstrapInput,
  CreateProyectoInput,
} from "../domain/coreData.js";

import {
  validateCreateCapaInput,
  validateCreatePozoCapaInput,
  validateCreatePozoInput,
  validateCreateProyectoBootstrapInput,
  validateCreateProyectoInput,
} from "../domain/coreData.js";

import { CoreDataRepository } from "../infrastructure/coreDataRepository.js";

// ✅ seed catálogo + unidades por proyecto
import { variablesService } from "../../variables/application/variablesService.js";

export class CoreDataService {
  private readonly repository = new CoreDataRepository();
  private schemaReady = false;

  /**
   * ✅ Inicializa un proyecto (bootstrap):
   * - crea Proyecto
   * - asegura catálogo mínimo (global)
   * - asegura Unidades default para este proyecto (settings por variable)
   */
  async initializeProyecto(
    input: CreateProyectoBootstrapInput,
  ): Promise<{ proyecto: Proyecto }> {
    validateCreateProyectoBootstrapInput(input);
    await this.ensureSchema();

    const proyectoId = randomUUID();
    const alias = input.nombre.trim().slice(0, 12).toUpperCase();

    const grillaCellSizeX =
      (input.arealMaxX - input.arealMinX) / input.grillaNx;
    const grillaCellSizeY =
      (input.arealMaxY - input.arealMinY) / input.grillaNy;

    const proyecto = await this.repository.createProyecto({
      id: proyectoId,
      nombre: input.nombre,
      alias,
      limitesTemporalDesde: input.limitesTemporalDesde,
      limitesTemporalHasta: input.limitesTemporalHasta,
      arealMinX: input.arealMinX,
      arealMinY: input.arealMinY,
      arealMaxX: input.arealMaxX,
      arealMaxY: input.arealMaxY,
      arealCRS: input.arealCRS,
      grillaNx: input.grillaNx,
      grillaNy: input.grillaNy,
      grillaCellSizeX,
      grillaCellSizeY,
      grillaUnidad: input.grillaUnidad,
    });

    await variablesService.ensureDefaultsForProject(proyectoId);

    return { proyecto };
  }

  async createProyecto(input: CreateProyectoInput): Promise<Proyecto> {
    validateCreateProyectoInput(input);
    await this.ensureSchema();

    const proyecto = await this.repository.createProyecto(input);

    // ✅ asegura defaults también en create “directo”
    await variablesService.ensureDefaultsForProject(proyecto.id);

    return proyecto;
  }

  async listProyectos(): Promise<Proyecto[]> {
    await this.ensureSchema();
    return this.repository.listProyectos();
  }

  async createCapa(input: CreateCapaInput): Promise<Capa> {
    validateCreateCapaInput(input);
    await this.ensureSchema();
    return this.repository.createCapa(input);
  }

  async listCapasByProject(proyectoId: string): Promise<Capa[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listCapasByProject(proyectoId);
  }

  async createPozo(input: CreatePozoInput): Promise<Pozo> {
    validateCreatePozoInput(input);
    await this.ensureSchema();
    return this.repository.createPozo(input);
  }

  async listPozosByProject(proyectoId: string): Promise<Pozo[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listPozosByProject(proyectoId);
  }

  async createPozoCapa(input: CreatePozoCapaInput): Promise<PozoCapa> {
    validateCreatePozoCapaInput(input);
    await this.ensureSchema();
    return this.repository.createPozoCapa(input);
  }

  async listPozoCapaByProject(proyectoId: string): Promise<PozoCapa[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listPozoCapaByProject(proyectoId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const coreDataService = new CoreDataService();
