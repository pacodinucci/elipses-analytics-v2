// src/electron/backend/store.js
import type { BackendBootstrapStatus, BackendTruthRegistry } from "./models.js";
import { databaseService } from "../shared/db/index.js";
import { migrations } from "../shared/db/migrations.js";

// ✅ usar el bootstrap correcto de variables por proyecto
import { variablesService } from "../modules/variables/application/variablesService.js";

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

  /**
   * ✅ Single-flight guard:
   * - evita correr applyMigrations dos veces en paralelo
   * - si se llama 2+ veces, todas esperan la misma promesa
   */
  private initSchemaPromise: Promise<BackendBootstrapStatus> | null = null;

  getTruthRegistry(): BackendTruthRegistry {
    return {
      entities: [...ENTITY_TABLES],
      notes: [
        "Mermaid class diagram is treated as source of truth.",
        "Schema is managed through versioned migrations in src/electron/shared/db/migrations.ts.",
        "Bootstrap creates physical tables in DuckDB (backend-v2.duckdb).",
        "Note: some legacy columns/tables may exist temporarily during migrations (e.g., Simulacion.setEstadoPozosId).",
      ],
    };
  }

  async initSchema(): Promise<BackendBootstrapStatus> {
    // ✅ si ya está inicializado, no hagas nada
    if (this.schemaInitialized) {
      return this.getBootstrapStatus();
    }

    // ✅ si hay una inicialización en curso, esperala
    if (this.initSchemaPromise) {
      return this.initSchemaPromise;
    }

    this.initSchemaPromise = (async () => {
      try {
        await this.db.applyMigrations(migrations);

        // ✅ solo true si applyMigrations terminó ok
        this.schemaInitialized = true;

        return await this.getBootstrapStatus();
      } finally {
        // ✅ si falló, permitimos reintentar; si salió ok, igual liberamos
        this.initSchemaPromise = null;
      }
    })();

    return this.initSchemaPromise;
  }

  async seedInitialData(): Promise<BackendBootstrapStatus> {
    await this.initSchema();

    const proyectoCount = await this.db.count("Proyecto");
    if (proyectoCount > 0) {
      return this.getBootstrapStatus();
    }

    const createdAt = nowISO();
    const updatedAt = createdAt;

    // ---------------------------
    // Proyecto demo
    // ---------------------------
    await this.db.run(
      `INSERT INTO Proyecto (
        id, nombre, alias, limitesTemporalDesde, limitesTemporalHasta,
        arealMinX, arealMinY, arealMaxX, arealMaxY, arealCRS,
        grillaNx, grillaNy, grillaCellSizeX, grillaCellSizeY, grillaUnidad,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        createdAt,
        updatedAt,
      ],
    );

    // ---------------------------
    // Tipos base (catálogos)
    // ---------------------------
    await this.db.run(
      `INSERT INTO TipoEscenario (id, nombre, extrasJson)
       SELECT ?, ?, '{}' WHERE NOT EXISTS (SELECT 1 FROM TipoEscenario WHERE id = ?)`,
      ["tipo-esc-base", "Base", "tipo-esc-base"],
    );

    await this.db.run(
      `INSERT INTO TipoSimulacion (id, nombre, extrasJson)
       SELECT ?, ?, '{}' WHERE NOT EXISTS (SELECT 1 FROM TipoSimulacion WHERE id = ?)`,
      ["tipo-sim-base", "Base", "tipo-sim-base"],
    );

    await this.db.run(
      `INSERT INTO TipoEstadoPozo (id, nombre, extrasJson)
       SELECT ?, ?, '{}' WHERE NOT EXISTS (SELECT 1 FROM TipoEstadoPozo WHERE id = ?)`,
      ["estado-productor", "Productor", "estado-productor"],
    );

    // ---------------------------
    // ✅ Catálogo global VariableMapa
    // ---------------------------
    // Nota: VariableMapa representa "qué variable raster" (Presión/Porosidad/etc.)
    // No representa la estructura grid.
    await this.db.run(
      `INSERT INTO VariableMapa (id, nombre, extrasJson)
       SELECT ?, ?, '{}' WHERE NOT EXISTS (SELECT 1 FROM VariableMapa WHERE id = ?)`,
      ["vm-presion", "Presión", "vm-presion"],
    );

    // ---------------------------
    // Capa + Pozo
    // ---------------------------
    await this.db.run(
      "INSERT INTO Capa (id, proyectoId, nombre, createdAt, updatedAt, extrasJson) VALUES (?, ?, ?, ?, ?, ?)",
      [
        "capa-a",
        "proj-demo",
        "Capa A",
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

    await this.db.run(
      "INSERT INTO Pozo (id, proyectoId, nombre, x, y, createdAt, updatedAt, extrasJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "pozo-a",
        "proj-demo",
        "Pozo A",
        10,
        20,
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

    // ---------------------------
    // Escenario base
    // ---------------------------
    await this.db.run(
      "INSERT INTO Escenario (id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt, extrasJson) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "esc-base",
        "proj-demo",
        "tipo-esc-base",
        "Escenario Base",
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

    /**
     * ---------------------------
     * Simulación + SetEstadoPozos (compat)
     * ---------------------------
     */
    await this.db.run(
      "INSERT INTO SetEstadoPozos (id, proyectoId, nombre, createdAt, updatedAt, extrasJson) VALUES (?, ?, ?, ?, ?, ?)",
      [
        "set-estados-base",
        "proj-demo",
        "Set Base",
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

    await this.db.run(
      `INSERT INTO Simulacion (
        id, proyectoId, tipoSimulacionId, escenarioSimulacionId, setEstadoPozosId, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "sim-base",
        "proj-demo",
        "tipo-sim-base",
        "esc-base",
        "set-estados-base",
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

    // v4: SetEstadoPozos.simulacionId (si existe) -> lo seteamos
    await this.db.run(
      "UPDATE SetEstadoPozos SET simulacionId = ? WHERE id = ?",
      ["sim-base", "set-estados-base"],
    );

    await this.db.run(
      `INSERT INTO SetEstadoPozosDetalle (
        id, setEstadoPozosId, pozoId, tipoEstadoPozoId, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "set-det-1",
        "set-estados-base",
        "pozo-a",
        "estado-productor",
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

    // ---------------------------
    // ✅ Bootstrap correcto por proyecto:
    // - crea GrupoVariable por templates
    // - crea Variables por grupo (y MAPA desde VariableMapa)
    // - crea al menos 1 fila en Unidades
    // ---------------------------
    await variablesService.ensureDefaultsForProject("proj-demo");

    // ---------------------------
    // Mapa demo (usa VariableMapa)
    // ---------------------------
    // grupoVariableId es legacy/compat -> puede ser NULL.
    await this.db.run(
      `INSERT INTO Mapa (
        id, proyectoId, capaId, variableMapaId, grupoVariableId,
        xedges, yedges, grid, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "mapa-capa-a-presion",
        "proj-demo",
        "capa-a",
        "vm-presion",
        null,
        JSON.stringify([0, 10, 20]),
        JSON.stringify([0, 10, 20]),
        JSON.stringify([
          [1, 2],
          [3, 4],
        ]),
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

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
