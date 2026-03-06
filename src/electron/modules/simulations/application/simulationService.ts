import type {
  Escenario,
  Simulacion,
  SimulacionEscenario,
  TipoSimulacion,
} from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type {
  CreateSimulacionInput,
  CreateTipoSimulacionInput,
  LinkSimulacionEscenarioInput,
} from "../domain/simulation.js";
import {
  validateCreateSimulacionInput,
  validateCreateTipoSimulacionInput,
  validateLinkSimulacionEscenarioInput,
} from "../domain/simulation.js";
import { SimulationRepository } from "../infrastructure/simulationRepository.js";

export class SimulationService {
  private readonly repository = new SimulationRepository();
  private schemaReady = false;

  async createTipoSimulacion(
    input: CreateTipoSimulacionInput,
  ): Promise<TipoSimulacion> {
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

  async linkSimulacionEscenario(
    input: LinkSimulacionEscenarioInput,
  ): Promise<SimulacionEscenario> {
    validateLinkSimulacionEscenarioInput(input);
    await this.ensureSchema();

    const simulacion = await this.repository.getSimulacionById(
      input.simulacionId,
    );
    if (!simulacion) {
      throw new Error("Simulacion not found");
    }

    const escenario = await this.getEscenarioById(input.escenarioId);
    if (!escenario) {
      throw new Error("Escenario not found");
    }

    if (simulacion.proyectoId !== escenario.proyectoId) {
      throw new Error(
        "Simulacion and Escenario must belong to the same proyecto",
      );
    }

    const existingLink =
      await this.repository.getSimulacionEscenarioBySimulacionId(
        input.simulacionId,
      );

    if (existingLink) {
      throw new Error("Simulacion already has an Escenario linked");
    }

    return this.repository.linkSimulacionEscenario(input);
  }

  private async getEscenarioById(
    escenarioId: string,
  ): Promise<Escenario | null> {
    const rows = await databaseService.readAll(
      `SELECT id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt, extrasJson
       FROM Escenario
       WHERE id = ?
       LIMIT 1`,
      [escenarioId],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: String(row.id),
      proyectoId: String(row.proyectoId),
      tipoEscenarioId: String(row.tipoEscenarioId),
      nombre: String(row.nombre),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      extrasJson:
        row.extrasJson && typeof row.extrasJson === "object"
          ? (row.extrasJson as Record<string, unknown>)
          : undefined,
    };
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
