import type { GrupoVariable, Variable } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateGrupoVariableInput, CreateVariableInput } from "../domain/variables.js";
import { validateCreateGrupoVariableInput, validateCreateVariableInput } from "../domain/variables.js";
import { VariablesRepository } from "../infrastructure/variablesRepository.js";

export class VariablesService {
  private readonly repository = new VariablesRepository();
  private schemaReady = false;

  async createGrupoVariable(input: CreateGrupoVariableInput): Promise<GrupoVariable> {
    validateCreateGrupoVariableInput(input);
    await this.ensureSchema();
    return this.repository.createGrupoVariable(input);
  }

  async listGrupoVariable(): Promise<GrupoVariable[]> {
    await this.ensureSchema();
    return this.repository.listGrupoVariable();
  }

  async createVariable(input: CreateVariableInput): Promise<Variable> {
    validateCreateVariableInput(input);
    await this.ensureSchema();
    return this.repository.createVariable(input);
  }

  async listVariableByUnidades(unidadesId: string): Promise<Variable[]> {
    if (!unidadesId) throw new Error("unidadesId is required");
    await this.ensureSchema();
    return this.repository.listVariableByUnidades(unidadesId);
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const variablesService = new VariablesService();
