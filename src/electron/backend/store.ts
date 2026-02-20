import type { BackendBootstrapStatus, BackendTruthRegistry } from "./models.js";
import { databaseService } from "../shared/db/index.js";
import { migrations } from "../shared/db/migrations.js";

function nowISO() {
  return new Date().toISOString();
}

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
  "Produccion",
  "VariableMapa",
  "Mapa",
] as const;

class BackendStore {
  private readonly db = databaseService;
  private schemaInitialized = false;

  getTruthRegistry(): BackendTruthRegistry {
    return {
      entities: [...ENTITY_TABLES],
      notes: [
        "Mermaid class diagram is treated as source of truth.",
        "Schema is managed through versioned migrations in src/electron/shared/db/migrations.ts.",
        "Bootstrap creates physical tables in DuckDB (backend-v2.duckdb).",
      ],
    };
  }

  async initSchema(): Promise<BackendBootstrapStatus> {
    await this.db.applyMigrations(migrations);
    this.schemaInitialized = true;
    return this.getBootstrapStatus();
  }

  async seedInitialData(): Promise<BackendBootstrapStatus> {
    await this.initSchema();

    const proyectoCount = await this.db.count("Proyecto");
    if (proyectoCount > 0) {
      return this.getBootstrapStatus();
    }

    const createdAt = nowISO();
    const updatedAt = createdAt;

    await this.db.run(
      `INSERT INTO Proyecto (
        id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        unidadesId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "proj-demo",
        "Proyecto Demo",
        "DEMO",
        "2020-01-01",
        "2030-01-01",
        0,
        0,
        100,
        100,
        "EPSG:4326",
        10,
        10,
        10,
        10,
        "m",
        "units-demo",
        createdAt,
        updatedAt,
      ]
    );

    await this.db.run(
      "INSERT INTO Unidades (id, proyectoId, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      ["units-demo", "proj-demo", createdAt, updatedAt]
    );

    await this.db.run("INSERT INTO TipoEscenario (id, nombre) VALUES (?, ?)", [
      "tipo-esc-base",
      "Base",
    ]);

    await this.db.run("INSERT INTO TipoSimulacion (id, nombre) VALUES (?, ?)", [
      "tipo-sim-base",
      "Base",
    ]);

    await this.db.run("INSERT INTO TipoEstadoPozo (id, nombre) VALUES (?, ?)", [
      "estado-productor",
      "Productor",
    ]);

    await this.db.run(
      "INSERT INTO Capa (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["capa-a", "proj-demo", "Capa A", createdAt, updatedAt]
    );

    await this.db.run(
      "INSERT INTO Pozo (id, proyectoId, nombre, x, y, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["pozo-a", "proj-demo", "Pozo A", 10, 20, createdAt, updatedAt]
    );

    await this.db.run(
      "INSERT INTO SetEstadoPozos (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["set-estados-base", "proj-demo", "Set Base", createdAt, updatedAt]
    );

    await this.db.run(
      `INSERT INTO SetEstadoPozosDetalle (
        id, setEstadoPozosId, pozoId, tipoEstadoPozoId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      ["set-det-1", "set-estados-base", "pozo-a", "estado-productor", createdAt, updatedAt]
    );

    await this.db.run(
      "INSERT INTO Escenario (id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["esc-base", "proj-demo", "tipo-esc-base", "Escenario Base", createdAt, updatedAt]
    );

    await this.db.run(
      `INSERT INTO Simulacion (
        id, proyectoId, tipoSimulacionId, escenarioSimulacionId, setEstadoPozosId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "sim-base",
        "proj-demo",
        "tipo-sim-base",
        "esc-base",
        "set-estados-base",
        createdAt,
        updatedAt,
      ]
    );

    await this.db.run("INSERT INTO VariableMapa (id, nombre) VALUES (?, ?)", [
      "var-mapa-1",
      "Presion",
    ]);

    await this.db.run(
      `INSERT INTO Mapa (
        id, proyectoId, capaId, variableMapaId, xedges, yedges, grid, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "mapa-capa-a",
        "proj-demo",
        "capa-a",
        "var-mapa-1",
        JSON.stringify([0, 10, 20]),
        JSON.stringify([0, 10, 20]),
        JSON.stringify([
          [1, 2],
          [3, 4],
        ]),
        createdAt,
        updatedAt,
      ]
    );

    return this.getBootstrapStatus();
  }

  async getBootstrapStatus(): Promise<BackendBootstrapStatus> {
    const entityCounts = Object.fromEntries(
      await Promise.all(
        ENTITY_TABLES.map(async (tableName) => [tableName, await this.safeCount(tableName)])
      )
    );

    return {
      seeded: (entityCounts.Proyecto ?? 0) > 0,
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
