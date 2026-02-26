import type { ValorEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import { migrations } from "../../../shared/db/migrations.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";
import { validateCreateValorEscenarioInput } from "../domain/scenarioValue.js";
import { ScenarioValueRepository } from "../infrastructure/scenarioValueRepository.js";

// ✅ para validar por tipo
import { ScenarioRepository } from "../../scenarios/infrastructure/scenarioRepository.js";

function hasAnyNonNull(values: Array<number | null | undefined>): boolean {
  return values.some((v) => v != null);
}

function normalizeTypeName(name: string): string {
  return name.trim().toLowerCase();
}

export class ScenarioValueService {
  private readonly repository = new ScenarioValueRepository();
  private readonly scenarioRepo = new ScenarioRepository();
  private schemaReady = false;

  /**
   * ✅ Mantiene el nombre "create" por compat de IPC,
   * pero semánticamente es UPSERT por llave compuesta.
   */
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

    const prodVals = [input.petroleo, input.agua, input.gas];
    const inyVals = [input.inyeccionAgua, input.inyeccionGas];

    // ✅ regla base universal: alguna métrica debe venir (si no, no tiene sentido la fila)
    if (!hasAnyNonNull([...prodVals, ...inyVals])) {
      throw new Error(
        `ValorEscenario inválido: se requiere al menos un valor no-null (escenarioId=${input.escenarioId}).`,
      );
    }

    const t = normalizeTypeName(tipo.nombre);

    // Heurísticas por convención de nombre
    const isInjection = t.includes("iny") || t.includes("inye");
    const isProduction = t.includes("prod") || t.includes("hist");
    const isMixed =
      t.includes("mix") || t.includes("amb") || t.includes("both");

    if (isMixed) {
      // permite cualquier combinación, ya pasó la regla base
      return;
    }

    if (isInjection && !hasAnyNonNull(inyVals)) {
      throw new Error(
        `ValorEscenario inválido para tipo "${tipo.nombre}": se requiere inyección (inyeccionAgua/inyeccionGas) no-null.`,
      );
    }

    if (isProduction && !hasAnyNonNull(prodVals)) {
      throw new Error(
        `ValorEscenario inválido para tipo "${tipo.nombre}": se requiere producción (petroleo/agua/gas) no-null.`,
      );
    }

    // Si no matchea ningún tipo conocido: permisivo (solo regla base).
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await databaseService.applyMigrations(migrations);
    this.schemaReady = true;
  }
}

export const scenarioValueService = new ScenarioValueService();
