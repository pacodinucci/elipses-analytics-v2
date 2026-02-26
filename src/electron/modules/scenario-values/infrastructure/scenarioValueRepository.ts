import type { ValorEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";

function toNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  // DuckDB puede devolver bigint/decimal como number o string dependiendo del driver
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function mapValorEscenario(row: Record<string, unknown>): ValorEscenario {
  return {
    id: String(row.id),
    escenarioId: String(row.escenarioId),
    pozoId: String(row.pozoId),
    capaId: String(row.capaId),
    fecha: String(row.fecha),

    // ✅ claves: preservar NULL (no convertir a 0)
    petroleo: toNullableNumber(row.petroleo),
    agua: toNullableNumber(row.agua),
    gas: toNullableNumber(row.gas),
    inyeccionGas: toNullableNumber(row.inyeccionGas),
    inyeccionAgua: toNullableNumber(row.inyeccionAgua),

    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export class ScenarioValueRepository {
  /**
   * ✅ UPSERT por llave compuesta (escenarioId, pozoId, capaId, fecha)
   * - createdAt se mantiene
   * - updatedAt se actualiza
   *
   * Nota: requiere el UNIQUE (escenarioId, pozoId, capaId, fecha) que ya tenés.
   */
  async upsert(input: CreateValorEscenarioInput): Promise<ValorEscenario> {
    const now = new Date().toISOString();

    // Normalizar undefined -> null (DB nullable)
    const petroleo = input.petroleo ?? null;
    const agua = input.agua ?? null;
    const gas = input.gas ?? null;
    const inyeccionGas = input.inyeccionGas ?? null;
    const inyeccionAgua = input.inyeccionAgua ?? null;

    // ✅ UPSERT: si existe por UNIQUE compuesto, hace update
    await databaseService.run(
      `INSERT INTO ValorEscenario (
        id, escenarioId, pozoId, capaId, fecha,
        petroleo, agua, gas, inyeccionGas, inyeccionAgua,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (escenarioId, pozoId, capaId, fecha)
      DO UPDATE SET
        petroleo = EXCLUDED.petroleo,
        agua = EXCLUDED.agua,
        gas = EXCLUDED.gas,
        inyeccionGas = EXCLUDED.inyeccionGas,
        inyeccionAgua = EXCLUDED.inyeccionAgua,
        updatedAt = EXCLUDED.updatedAt`,
      [
        input.id,
        input.escenarioId,
        input.pozoId,
        input.capaId,
        input.fecha,
        petroleo,
        agua,
        gas,
        inyeccionGas,
        inyeccionAgua,
        now,
        now,
      ],
    );

    // ✅ leer por llave compuesta (no por id) porque en upsert
    // puede existir un id previo distinto al input.id
    const rows = await databaseService.readAll(
      `SELECT id, escenarioId, pozoId, capaId, fecha,
              petroleo, agua, gas, inyeccionGas, inyeccionAgua,
              createdAt, updatedAt
       FROM ValorEscenario
       WHERE escenarioId = ?
         AND pozoId = ?
         AND capaId = ?
         AND fecha = ?
       LIMIT 1`,
      [input.escenarioId, input.pozoId, input.capaId, input.fecha],
    );

    if (rows.length === 0) {
      throw new Error("ValorEscenario upsert failed");
    }

    return mapValorEscenario(rows[0]);
  }

  // ✅ Compat (si algún código interno llama create)
  async create(input: CreateValorEscenarioInput): Promise<ValorEscenario> {
    return this.upsert(input);
  }

  async listByEscenario(escenarioId: string): Promise<ValorEscenario[]> {
    const rows = await databaseService.readAll(
      `SELECT id, escenarioId, pozoId, capaId, fecha,
              petroleo, agua, gas, inyeccionGas, inyeccionAgua,
              createdAt, updatedAt
       FROM ValorEscenario
       WHERE escenarioId = ?
       ORDER BY fecha ASC, createdAt ASC`,
      [escenarioId],
    );

    return rows.map(mapValorEscenario);
  }
}
