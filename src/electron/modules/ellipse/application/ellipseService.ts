// src/electron/modules/ellipse/ellipseService.ts
import type {
  Elipse,
  ElipseValor,
  ElipseVariable,
} from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type {
  CreateElipseInput,
  CreateElipseValorInput,
  CreateElipseVariableInput,
} from "../domain/ellipse.js";
import {
  validateCreateElipseInput,
  validateCreateElipseValorInput,
  validateCreateElipseVariableInput,
} from "../domain/ellipse.js";
import { EllipseRepository } from "../infrastructure/ellipseRepository.js";
import type { ElipsesNormalizationAllPayload } from "../interfaces/ipc.js";

export class EllipseService {
  private readonly repository = new EllipseRepository();
  private schemaReady = false;

  // =========================
  // ✅ ELIPSE (geometría por simulación)
  // =========================
  async createElipse(input: CreateElipseInput): Promise<Elipse> {
    validateCreateElipseInput(input);
    await this.ensureSchema();
    return this.repository.createElipse(input);
  }

  /**
   * ✅ v7: elipses son por simulación + capa
   */
  async listElipsesByLayer(
    simulacionId: string,
    capaId: string,
  ): Promise<Elipse[]> {
    if (!simulacionId) throw new Error("simulacionId is required");
    if (!capaId) throw new Error("capaId is required");
    await this.ensureSchema();
    return this.repository.listElipsesByLayer(simulacionId, capaId);
  }

  async listElipsesByProject(proyectoId: string): Promise<Elipse[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listElipsesByProject(proyectoId);
  }

  // =========================
  // ✅ VARIABLES
  // =========================
  async createVariable(
    input: CreateElipseVariableInput,
  ): Promise<ElipseVariable> {
    validateCreateElipseVariableInput(input);
    await this.ensureSchema();
    return this.repository.createVariable(input);
  }

  async listVariables(): Promise<ElipseVariable[]> {
    await this.ensureSchema();
    return this.repository.listVariables();
  }

  // =========================
  // ✅ VALORES (depende de Elipse)
  // =========================
  async createValor(input: CreateElipseValorInput): Promise<ElipseValor> {
    validateCreateElipseValorInput(input);
    await this.ensureSchema();
    return this.repository.createValor(input);
  }

  /**
   * ✅ compat: se mantiene la API por simulación, pero el repo lo resuelve con JOIN Elipse
   */
  async listValoresBySimulacion(simulacionId: string): Promise<ElipseValor[]> {
    if (!simulacionId) throw new Error("simulacionId is required");
    await this.ensureSchema();
    return this.repository.listValoresBySimulacion(simulacionId);
  }

  // ✅ Normalización (por proyecto; opcional por simulación)
  async elipsesNormalizationAll(payload: ElipsesNormalizationAllPayload) {
    await this.ensureSchema();

    const proyectoId = payload.proyectoId ?? payload.yacimientoId ?? null;
    if (!proyectoId) {
      return { ok: false as const, error: "proyectoId is required" };
    }

    const scope = payload.scope;
    const capa = payload.capa ?? null;
    const fecha = payload.fecha ?? null;

    // ✅ v7: si el renderer lo manda, filtramos universo por simulación
    const simulacionId = payload.simulacionId ?? null;

    try {
      const ranges = await this.repository.elipsesNormalizationAll({
        proyectoId,
        scope,
        capa,
        fecha,
        simulacionId,
      });

      return { ok: true as const, ranges };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const ellipseService = new EllipseService();
