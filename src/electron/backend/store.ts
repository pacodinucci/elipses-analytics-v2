// src/electron/backend/store.js
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
    // Proyecto (✅ sin unidadesId)
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
    // Tipos base
    // ---------------------------
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

    // ---------------------------
    // Capa + Pozo
    // ---------------------------
    await this.db.run(
      "INSERT INTO Capa (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["capa-a", "proj-demo", "Capa A", createdAt, updatedAt],
    );

    await this.db.run(
      "INSERT INTO Pozo (id, proyectoId, nombre, x, y, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["pozo-a", "proj-demo", "Pozo A", 10, 20, createdAt, updatedAt],
    );

    // ---------------------------
    // Escenario base
    // ---------------------------
    await this.db.run(
      "INSERT INTO Escenario (id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      [
        "esc-base",
        "proj-demo",
        "tipo-esc-base",
        "Escenario Base",
        createdAt,
        updatedAt,
      ],
    );

    /**
     * ---------------------------
     * Simulación + SetEstadoPozos (compat)
     * ---------------------------
     *
     * Dominio nuevo:
     * - Simulacion NO requiere setEstadoPozosId
     * - SetEstadoPozos requiere simulacionId y NO tiene proyectoId
     *
     * Pero el schema transicional todavía puede tener:
     * - Simulacion.setEstadoPozosId NOT NULL
     * - SetEstadoPozos.proyectoId NOT NULL
     *
     * Entonces para seed:
     * 1) crear SetEstadoPozos con proyectoId (legacy)
     * 2) crear Simulacion apuntando a setEstadoPozosId (legacy)
     * 3) actualizar SetEstadoPozos.simulacionId (columna v4) con el id de la simulación
     */
    await this.db.run(
      "INSERT INTO SetEstadoPozos (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["set-estados-base", "proj-demo", "Set Base", createdAt, updatedAt],
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
      ],
    );

    // v4: SetEstadoPozos.simulacionId (si existe) -> lo seteamos
    await this.db.run(
      "UPDATE SetEstadoPozos SET simulacionId = ? WHERE id = ?",
      ["sim-base", "set-estados-base"],
    );

    await this.db.run(
      `INSERT INTO SetEstadoPozosDetalle (
        id, setEstadoPozosId, pozoId, tipoEstadoPozoId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "set-det-1",
        "set-estados-base",
        "pozo-a",
        "estado-productor",
        createdAt,
        updatedAt,
      ],
    );

    // ---------------------------
    // GrupoVariable para map (nuevo dominio)
    // ---------------------------
    await this.db.run(
      `INSERT INTO GrupoVariable (
        id, proyectoId, nombre, orden, scope, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "grp-proj-demo-mapa-base",
        "proj-demo",
        "Mapa Base",
        0,
        "MAPA",
        createdAt,
        updatedAt,
        {},
      ],
    );

    await this.db.run(
      "INSERT INTO VariableMapa (id, nombre) VALUES (?, ?)",
      ["vm-proj-demo-grid", "Grid"],
    );

    await this.db.run(
      `INSERT INTO Mapa (
        id, proyectoId, capaId, variableMapaId, grupoVariableId, xedges, yedges, grid, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "mapa-capa-a",
        "proj-demo",
        "capa-a",
        "vm-proj-demo-grid",
        "grp-proj-demo-mapa-base",
        JSON.stringify([0, 10, 20]),
        JSON.stringify([0, 10, 20]),
        JSON.stringify([
          [1, 2],
          [3, 4],
        ]),
        createdAt,
        updatedAt,
      ],
    );

    // ---------------------------
    // ✅ NUEVO: GrupoVariable PROYECTO + Variable + Unidades(setting)
    // ---------------------------
    await this.db.run(
      `INSERT INTO GrupoVariable (
        id, proyectoId, nombre, orden, scope, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "grp-proj-demo-unidades",
        "proj-demo",
        "Unidades",
        1,
        "UNIDADES",
        createdAt,
        updatedAt,
        {},
      ],
    );

    await this.db.run(
      `INSERT INTO Variable (
        id, grupoVariableId, nombre, codigo, tipoDato, configJson, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "var-flow-rate",
        "grp-proj-demo-unidades",
        "Caudal (unidad)",
        "FLOW_RATE_UNIT",
        "string",
        JSON.stringify({}),
        createdAt,
        updatedAt,
        JSON.stringify({}),
      ],
    );

    // settings: en este proyecto, FLOW_RATE_UNIT = "m3/d"
    await this.db.run(
      `INSERT INTO Unidades (
        id, proyectoId, unidad, configJson, createdAt, updatedAt, extrasJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "units-proj-demo-flow",
        "proj-demo",
        "m3/d",
        JSON.stringify({}),
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
