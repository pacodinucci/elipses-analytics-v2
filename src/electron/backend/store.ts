import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BackendBootstrapStatus, BackendTruthRegistry } from "./models.js";

function nowISO() {
  return new Date().toISOString();
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS Proyecto (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    alias VARCHAR NOT NULL,
    limitesTemporalDesde DATE NOT NULL,
    limitesTemporalHasta DATE NOT NULL,
    arealMinX DOUBLE NOT NULL,
    arealMinY DOUBLE NOT NULL,
    arealMaxX DOUBLE NOT NULL,
    arealMaxY DOUBLE NOT NULL,
    arealCRS VARCHAR NOT NULL,
    grillaNx INTEGER NOT NULL,
    grillaNy INTEGER NOT NULL,
    grillaCellSizeX DOUBLE NOT NULL,
    grillaCellSizeY DOUBLE NOT NULL,
    grillaUnidad VARCHAR NOT NULL,
    unidadesId VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Unidades (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS GrupoVariable (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    orden INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Variable (
    id VARCHAR PRIMARY KEY,
    grupoVariableId VARCHAR NOT NULL REFERENCES GrupoVariable(id),
    unidadesId VARCHAR NOT NULL REFERENCES Unidades(id),
    nombre VARCHAR NOT NULL,
    codigo VARCHAR NOT NULL,
    tipoDato VARCHAR NOT NULL,
    unidad VARCHAR NOT NULL,
    configJson JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Capa (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    nombre VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Pozo (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    nombre VARCHAR NOT NULL,
    x DOUBLE NOT NULL,
    y DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS PozoCapa (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    tope DOUBLE NOT NULL,
    base DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS TipoSimulacion (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS TipoEstadoPozo (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS SetEstadoPozos (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    nombre VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS SetEstadoPozosDetalle (
    id VARCHAR PRIMARY KEY,
    setEstadoPozosId VARCHAR NOT NULL REFERENCES SetEstadoPozos(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    tipoEstadoPozoId VARCHAR NOT NULL REFERENCES TipoEstadoPozo(id),
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS TipoEscenario (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Escenario (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    tipoEscenarioId VARCHAR NOT NULL REFERENCES TipoEscenario(id),
    nombre VARCHAR NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ValorEscenario (
    id VARCHAR PRIMARY KEY,
    escenarioId VARCHAR NOT NULL REFERENCES Escenario(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    fecha DATE NOT NULL,
    petroleo DOUBLE NOT NULL,
    agua DOUBLE NOT NULL,
    gas DOUBLE NOT NULL,
    inyeccionGas DOUBLE NOT NULL,
    inyeccionAgua DOUBLE NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ElipseVariable (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ElipseValor (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    elipseVariableId VARCHAR NOT NULL REFERENCES ElipseVariable(id),
    valor DOUBLE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Simulacion (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    tipoSimulacionId VARCHAR NOT NULL REFERENCES TipoSimulacion(id),
    escenarioSimulacionId VARCHAR NOT NULL REFERENCES Escenario(id),
    setEstadoPozosId VARCHAR NOT NULL REFERENCES SetEstadoPozos(id),
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Produccion (
    id BIGINT PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    pozoId VARCHAR NOT NULL REFERENCES Pozo(id),
    capaId VARCHAR NOT NULL REFERENCES Capa(id),
    fecha DATE NOT NULL,
    petroleo DOUBLE NOT NULL,
    agua DOUBLE NOT NULL,
    gas DOUBLE NOT NULL,
    agua_iny DOUBLE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS VariableMapa (
    id VARCHAR PRIMARY KEY,
    nombre VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Mapa (
    id VARCHAR PRIMARY KEY,
    proyectoId VARCHAR NOT NULL REFERENCES Proyecto(id),
    capaId VARCHAR NOT NULL UNIQUE REFERENCES Capa(id),
    variableMapaId VARCHAR NOT NULL REFERENCES VariableMapa(id),
    xedges JSON NOT NULL,
    yedges JSON NOT NULL,
    grid JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL
  )`,
];


interface DuckDBReader {
  getRowsJson(): Array<{ count?: number }>;
}

interface DuckDBConnection {
  run(sql: string, params?: unknown[]): Promise<void>;
  runAndReadAll(sql: string): Promise<DuckDBReader>;
}

interface DuckDBInstance {
  connect(): Promise<DuckDBConnection>;
}

interface DuckDBModule {
  DuckDBInstance: {
    create(path: string): Promise<DuckDBInstance>;
  };
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
  private readonly databasePath = resolve(process.cwd(), "data", "backend-v2.duckdb");
  private connectionPromise?: Promise<DuckDBConnection>;
  private schemaInitialized = false;

  constructor() {
    mkdirSync(dirname(this.databasePath), { recursive: true });
  }

  getTruthRegistry(): BackendTruthRegistry {
    return {
      entities: [...ENTITY_TABLES],
      notes: [
        "Mermaid class diagram is treated as source of truth.",
        "Bootstrap creates physical SQL tables in DuckDB (backend-v2.duckdb).",
        "Mapa is DB-backed in v2 (replacing legacy JSON file reads).",
      ],
    };
  }

  async initSchema(): Promise<BackendBootstrapStatus> {
    const connection = await this.getConnection();

    for (const statement of SCHEMA_STATEMENTS) {
      await connection.run(statement);
    }

    this.schemaInitialized = true;
    return this.getBootstrapStatus();
  }

  async seedInitialData(): Promise<BackendBootstrapStatus> {
    await this.initSchema();
    const proyectoCount = await this.tableCount("Proyecto");

    if (proyectoCount > 0) {
      return this.getBootstrapStatus();
    }

    const createdAt = nowISO();
    const updatedAt = createdAt;

    await this.run(
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

    await this.run(
      "INSERT INTO Unidades (id, proyectoId, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      ["units-demo", "proj-demo", createdAt, updatedAt]
    );

    await this.run("INSERT INTO TipoEscenario (id, nombre) VALUES (?, ?)", [
      "tipo-esc-base",
      "Base",
    ]);

    await this.run("INSERT INTO TipoSimulacion (id, nombre) VALUES (?, ?)", [
      "tipo-sim-base",
      "Base",
    ]);

    await this.run("INSERT INTO TipoEstadoPozo (id, nombre) VALUES (?, ?)", [
      "estado-productor",
      "Productor",
    ]);

    await this.run(
      "INSERT INTO Capa (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["capa-a", "proj-demo", "Capa A", createdAt, updatedAt]
    );

    await this.run(
      "INSERT INTO Pozo (id, proyectoId, nombre, x, y, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["pozo-a", "proj-demo", "Pozo A", 10, 20, createdAt, updatedAt]
    );

    await this.run(
      "INSERT INTO SetEstadoPozos (id, proyectoId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["set-estados-base", "proj-demo", "Set Base", createdAt, updatedAt]
    );

    await this.run(
      `INSERT INTO SetEstadoPozosDetalle (
        id, setEstadoPozosId, pozoId, tipoEstadoPozoId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      ["set-det-1", "set-estados-base", "pozo-a", "estado-productor", createdAt, updatedAt]
    );

    await this.run(
      "INSERT INTO Escenario (id, proyectoId, tipoEscenarioId, nombre, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["esc-base", "proj-demo", "tipo-esc-base", "Escenario Base", createdAt, updatedAt]
    );

    await this.run(
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

    await this.run("INSERT INTO VariableMapa (id, nombre) VALUES (?, ?)", [
      "var-mapa-1",
      "Presion",
    ]);

    await this.run(
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
        ENTITY_TABLES.map(async (tableName) => [tableName, await this.tableCount(tableName)])
      )
    );

    return {
      seeded: (entityCounts.Proyecto ?? 0) > 0,
      schemaInitialized: this.schemaInitialized,
      databasePath: this.databasePath,
      entityCounts,
    };
  }

  private async getConnection(): Promise<DuckDBConnection> {
    if (!this.connectionPromise) {
      this.connectionPromise = this.createConnection();
    }

    return this.connectionPromise;
  }

  private async createConnection(): Promise<DuckDBConnection> {
    const moduleName = "@duckdb/node-api";
    const duckdb = (await import(moduleName)) as DuckDBModule;
    const instance = await duckdb.DuckDBInstance.create(this.databasePath);
    return instance.connect();
  }

  private async run(sql: string, params: unknown[]): Promise<void> {
    const connection = await this.getConnection();
    await connection.run(sql, params);
  }

  private async tableCount(tableName: string): Promise<number> {
    if (!this.schemaInitialized) {
      return 0;
    }

    const connection = await this.getConnection();
    const reader = await connection.runAndReadAll(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rows = reader.getRowsJson();
    return Number(rows[0]?.count ?? 0);
  }
}

export const backendStore = new BackendStore();
