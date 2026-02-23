import type { ElipseValor, ElipseVariable } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateElipseValorInput, CreateElipseVariableInput } from "../domain/ellipse.js";
import { validateCreateElipseValorInput, validateCreateElipseVariableInput } from "../domain/ellipse.js";
import { EllipseRepository } from "../infrastructure/ellipseRepository.js";

export class EllipseService {
  private readonly repository = new EllipseRepository();
  private schemaReady = false;

  async createVariable(input: CreateElipseVariableInput): Promise<ElipseVariable> {
    validateCreateElipseVariableInput(input);
    await this.ensureSchema();
    return this.repository.createVariable(input);
  }

  async listVariables(): Promise<ElipseVariable[]> {
    await this.ensureSchema();
    return this.repository.listVariables();
  }

  async createValor(input: CreateElipseValorInput): Promise<ElipseValor> {
    validateCreateElipseValorInput(input);
    await this.ensureSchema();
    return this.repository.createValor(input);
  }

  async listValoresByProject(proyectoId: string): Promise<ElipseValor[]> {
    if (!proyectoId) throw new Error("proyectoId is required");
    await this.ensureSchema();
    return this.repository.listValoresByProject(proyectoId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const ellipseService = new EllipseService();
