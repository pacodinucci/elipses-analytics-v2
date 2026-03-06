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
  RecomputeProyectoArealFromPozosInput,
} from "../domain/coreData.js";

import {
  validateCreateCapaInput,
  validateCreatePozoCapaInput,
  validateCreatePozoInput,
  validateCreateProyectoBootstrapInput,
  validateCreateProyectoInput,
  validateRecomputeProyectoArealFromPozosInput,
} from "../domain/coreData.js";

import { CoreDataRepository } from "../infrastructure/coreDataRepository.js";
import { variablesService } from "../../variables/application/variablesService.js";
import { simulationService } from "../../simulations/application/simulationService.js";

export class CoreDataService {
  private readonly repository = new CoreDataRepository();
  private schemaReady = false;

  /**
   * ✅ Bootstrap mínimo
   * - CRS = null
   * - grillaUnidad = "m"
   * - Nx = Ny = gridDim
   * - areal/cellSize null hasta cargar pozos
   *
   * ✅ Además:
   * - asegura Unidades default del proyecto
   * - crea Simulacion "default"
   */
  async initializeProyecto(
    input: CreateProyectoBootstrapInput,
  ): Promise<{ proyecto: Proyecto }> {
    validateCreateProyectoBootstrapInput(input);
    await this.ensureSchema();

    const proyectoId = randomUUID();
    const alias = input.nombre.trim().slice(0, 12).toUpperCase();

    const proyecto = await this.repository.createProyecto({
      id: proyectoId,
      nombre: input.nombre,
      alias,
      limitesTemporalDesde: input.limitesTemporalDesde,
      limitesTemporalHasta: input.limitesTemporalHasta,

      arealMinX: null,
      arealMinY: null,
      arealMaxX: null,
      arealMaxY: null,
      arealCRS: null,

      grillaNx: input.gridDim,
      grillaNy: input.gridDim,

      grillaCellSizeX: null,
      grillaCellSizeY: null,

      grillaUnidad: "m",
    });

    await variablesService.ensureDefaultsForProject(proyectoId);
    await this.ensureDefaultProjectArtifacts(proyectoId);

    return { proyecto };
  }

  async recomputeProyectoArealFromPozos(
    input: RecomputeProyectoArealFromPozosInput,
  ): Promise<{ proyecto: Proyecto }> {
    validateRecomputeProyectoArealFromPozosInput(input);
    await this.ensureSchema();

    const updated =
      await this.repository.recomputeProyectoArealFromPozos(input);
    return { proyecto: updated };
  }

  async createProyecto(input: CreateProyectoInput): Promise<Proyecto> {
    validateCreateProyectoInput(input);
    await this.ensureSchema();

    const proyecto = await this.repository.createProyecto(input);
    await variablesService.ensureDefaultsForProject(proyecto.id);
    await this.ensureDefaultProjectArtifacts(proyecto.id);

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

  private async ensureDefaultProjectArtifacts(
    proyectoId: string,
  ): Promise<void> {
    await this.ensureDefaultTipoSimulacion();
    await this.ensureDefaultUnidades(proyectoId);

    const simulacionId = randomUUID();

    await simulationService.createSimulacion({
      id: simulacionId,
      proyectoId,
      tipoSimulacionId: "history-match",
      nombre: "default",
    });
  }

  private async ensureDefaultTipoSimulacion(): Promise<void> {
    await databaseService.run(
      `INSERT INTO TipoSimulacion (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoSimulacion WHERE id = ?)`,
      ["history-match", "history match", "history-match"],
    );
  }

  private async ensureDefaultUnidades(proyectoId: string): Promise<void> {
    const now = new Date().toISOString();

    await databaseService.run(
      `INSERT INTO Unidades (id, proyectoId, unidad, configJson, createdAt, updatedAt, extrasJson)
       SELECT ?, ?, ?, '{}', ?, ?, '{}'
       WHERE NOT EXISTS (
         SELECT 1
         FROM Unidades
         WHERE proyectoId = ? AND unidad = ?
       )`,
      [randomUUID(), proyectoId, "m", now, now, proyectoId, "m"],
    );
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const coreDataService = new CoreDataService();
