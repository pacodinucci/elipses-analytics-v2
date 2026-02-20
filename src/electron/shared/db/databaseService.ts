import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Migration } from "./migrations.js";

interface DuckDBReader {
  getRowsJson(): Array<Record<string, unknown>>;
}

interface DuckDBConnection {
  run(sql: string, params?: unknown[]): Promise<void>;
  runAndReadAll(sql: string, params?: unknown[]): Promise<DuckDBReader>;
}

interface DuckDBInstance {
  connect(): Promise<DuckDBConnection>;
}

interface DuckDBModule {
  DuckDBInstance: {
    create(path: string): Promise<DuckDBInstance>;
  };
}

export interface MigrationResult {
  latestVersion: number;
  appliedCount: number;
}

export class DatabaseService {
  readonly databasePath: string;
  private connectionPromise?: Promise<DuckDBConnection>;

  constructor(pathFromRoot = "data/backend-v2.duckdb") {
    this.databasePath = resolve(process.cwd(), pathFromRoot);
    mkdirSync(dirname(this.databasePath), { recursive: true });
  }

  async applyMigrations(migrations: Migration[]): Promise<MigrationResult> {
    await this.ensureMigrationTable();

    const appliedVersions = new Set(await this.getAppliedMigrationVersions());
    let appliedCount = 0;
    let latestVersion = 0;

    for (const migration of migrations) {
      latestVersion = Math.max(latestVersion, migration.version);
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      for (const statement of migration.statements) {
        await this.run(statement);
      }

      await this.run(
        "INSERT INTO schema_migrations (version, name, appliedAt) VALUES (?, ?, ?)",
        [migration.version, migration.name, new Date().toISOString()]
      );
      appliedCount += 1;
    }

    return { latestVersion, appliedCount };
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    const connection = await this.getConnection();
    await connection.run(sql, params);
  }

  async count(tableName: string): Promise<number> {
    const rows = await this.readAll(`SELECT COUNT(*) as count FROM ${tableName}`);
    return Number(rows[0]?.count ?? 0);
  }

  async readAll(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    const connection = await this.getConnection();
    const reader = await connection.runAndReadAll(sql, params);
    return reader.getRowsJson();
  }

  async getAppliedMigrationVersions(): Promise<number[]> {
    const rows = await this.readAll("SELECT version FROM schema_migrations");
    return rows
      .map((row) => Number(row.version))
      .filter((version) => Number.isInteger(version));
  }

  private async ensureMigrationTable(): Promise<void> {
    await this.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version BIGINT PRIMARY KEY,
      name VARCHAR NOT NULL,
      appliedAt TIMESTAMP NOT NULL
    )`);
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
}
