import type { ValorEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";
import { validateCreateValorEscenarioInput } from "../domain/scenarioValue.js";
import { ScenarioValueRepository } from "../infrastructure/scenarioValueRepository.js";
import { ScenarioRepository } from "../../scenarios/infrastructure/scenarioRepository.js";

function hasAnyNonNull(values: Array<number | null | undefined>): boolean {
  return values.some((v) => v != null);
}

function normalizeTipoId(id: string): string {
  return id.trim().toLowerCase();
}

export class ScenarioValueService {
  private readonly repository = new ScenarioValueRepository();
  private readonly scenarioRepo = new ScenarioRepository();
  private schemaReady = false;

  async create(input: CreateValorEscenarioInput): Promise<ValorEscenario> {
    validateCreateValorEscenarioInput(input);
    await this.ensureSchema();
    await this.validateByScenarioType(input);
    return this.repository.upsert(input);
  }

  async upsert(input: CreateValorEscenarioInput): Promise<ValorEscenario> {
    validateCreateValorEscenarioInput(input);
    await this.ensureSchema();
    await this.validateByScenarioType(input);
    return this.repository.upsert(input);
  }

  async listByEscenario(escenarioId: string): Promise<ValorEscenario[]> {
    if (!escenarioId) {
      throw new Error("escenarioId is required");
    }

    await this.ensureSchema();
    return this.repository.listByEscenario(escenarioId);
  }

  private async validateByScenarioType(
    input: CreateValorEscenarioInput,
  ): Promise<void> {
    const escenario = await this.scenarioRepo.getEscenarioById(
      input.escenarioId,
    );
    if (!escenario) {
      throw new Error(`Escenario no existe: escenarioId=${input.escenarioId}`);
    }

    const tipo = await this.scenarioRepo.getTipoEscenarioById(
      escenario.tipoEscenarioId,
    );
    if (!tipo) {
      throw new Error(
        `TipoEscenario no existe: tipoEscenarioId=${escenario.tipoEscenarioId}`,
      );
    }

    if (
      !hasAnyNonNull([
        input.petroleo,
        input.agua,
        input.gas,
        input.inyeccionGas,
        input.inyeccionAgua,
      ])
    ) {
      throw new Error(
        `ValorEscenario inválido: se requiere al menos una métrica no-null.`,
      );
    }

    const tipoId = normalizeTipoId(tipo.id);

    if (tipoId === "historia") {
      if (input.capaId != null && String(input.capaId).trim() !== "") {
        throw new Error(
          `ValorEscenario inválido para tipo "historia": no debe informar capaId.`,
        );
      }
      return;
    }

    if (tipoId === "datos") {
      if (!input.capaId || !String(input.capaId).trim()) {
        throw new Error(
          `ValorEscenario inválido para tipo "datos": capaId es obligatorio.`,
        );
      }
      return;
    }

    // primaria / inyeccion / otros:
    // por ahora no imponemos reglas extra en el create manual
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const scenarioValueService = new ScenarioValueService();
