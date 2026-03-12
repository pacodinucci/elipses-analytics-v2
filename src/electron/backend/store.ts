import type { BackendBootstrapStatus, BackendTruthRegistry } from "./models.js";
import { databaseService } from "../shared/db/index.js";
import { migrations } from "../shared/db/migrations.js";
import { wellStatesService } from "../modules/well-states/application/wellStatesService.js";

const ENTITY_TABLES = [
  "Proyecto",
  "Unidades",
  "GrupoVariable",
  "Variable",
  "Capa",
  "Pozo",
  "PozoCapa",
  "TipoSimulacion",
  "TipoEstadoPozo",
  "SetEstadoPozos",
  "SetEstadoPozosDetalle",
  "TipoEscenario",
  "Escenario",
  "ValorEscenario",
  "ElipseVariable",
  "ElipseValor",
  "Simulacion",
  "SimulacionEscenario",
  "Produccion",
  "VariableMapa",
  "Mapa",
] as const;

class BackendStore {
  private readonly db = databaseService;
  private schemaInitialized = false;
  private initSchemaPromise: Promise<BackendBootstrapStatus> | null = null;

  getTruthRegistry(): BackendTruthRegistry {
    return {
      entities: [...ENTITY_TABLES],
      notes: [
        "Mermaid class diagram is treated as source of truth.",
        "Schema is managed through versioned migrations in src/electron/shared/db/migrations.ts.",
        "Bootstrap creates physical tables in DuckDB (backend-v2.duckdb).",
        "Simulacion no depende obligatoriamente de Escenario ni de SetEstadoPozos.",
      ],
    };
  }

  async initSchema(): Promise<BackendBootstrapStatus> {
    if (this.schemaInitialized) {
      return this.getBootstrapStatus();
    }

    if (this.initSchemaPromise) {
      return this.initSchemaPromise;
    }

    this.initSchemaPromise = (async () => {
      try {
        await this.db.applyMigrations(migrations);
        this.schemaInitialized = true;
        return await this.getBootstrapStatus();
      } finally {
        this.initSchemaPromise = null;
      }
    })();

    return this.initSchemaPromise;
  }

  async seedInitialData(): Promise<BackendBootstrapStatus> {
    await this.initSchema();

    await this.db.run(
      `INSERT INTO TipoEscenario (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoEscenario WHERE id = ?)`,
      ["historia", "Historia", "historia"],
    );

    await this.db.run(
      `INSERT INTO TipoEscenario (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoEscenario WHERE id = ?)`,
      ["datos", "Datos", "datos"],
    );

    await this.db.run(
      `INSERT INTO TipoEscenario (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoEscenario WHERE id = ?)`,
      ["primaria", "Primaria", "primaria"],
    );

    await this.db.run(
      `INSERT INTO TipoEscenario (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoEscenario WHERE id = ?)`,
      ["inyeccion", "Inyeccion", "inyeccion"],
    );

    await this.db.run(
      `INSERT INTO TipoSimulacion (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoSimulacion WHERE id = ?)`,
      ["history-match", "history match", "history-match"],
    );

    await this.db.run(
      `INSERT INTO TipoSimulacion (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoSimulacion WHERE id = ?)`,
      ["coa", "coa", "coa"],
    );

    await this.db.run(
      `INSERT INTO TipoSimulacion (id, nombre, extrasJson)
       SELECT ?, ?, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM TipoSimulacion WHERE id = ?)`,
      [
        "alternativa-desarrollo",
        "alternativa de desarrollo",
        "alternativa-desarrollo",
      ],
    );

    await wellStatesService.ensureDefaultTiposEstadoPozo();

    return this.getBootstrapStatus();
  }

  async getBootstrapStatus(): Promise<BackendBootstrapStatus> {
    const entityCounts = Object.fromEntries(
      await Promise.all(
        ENTITY_TABLES.map(async (tableName) => [
          tableName,
          await this.safeCount(tableName),
        ]),
      ),
    );

    return {
      seeded: (entityCounts.TipoEscenario ?? 0) > 0,
      schemaInitialized: this.schemaInitialized,
      databasePath: this.db.databasePath,
      entityCounts,
    };
  }

  private async safeCount(tableName: string): Promise<number> {
    if (!this.schemaInitialized) {
      return 0;
    }

    try {
      return await this.db.count(tableName);
    } catch {
      return 0;
    }
  }
}

export const backendStore = new BackendStore();
