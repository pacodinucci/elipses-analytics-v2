import type { ValorEscenario } from "../../../backend/models.js";
import { databaseService } from "../../../shared/db/index.js";
import type { CreateValorEscenarioInput } from "../domain/scenarioValue.js";

const NO_CAPA_SCOPE_KEY = "__NO_CAPA__";

function toNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function toNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function buildCapaScopeKey(capaId?: string | null): string {
  const normalized = capaId?.trim() ?? "";
  return normalized.length > 0 ? normalized : NO_CAPA_SCOPE_KEY;
}

function mapValorEscenario(row: Record<string, unknown>): ValorEscenario {
  return {
    id: String(row.id),
    escenarioId: String(row.escenarioId),
    pozoId: String(row.pozoId),
    capaId: toNullableString(row.capaId),
    fecha: String(row.fecha),

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
  async upsert(input: CreateValorEscenarioInput): Promise<ValorEscenario> {
    const now = new Date().toISOString();

    const capaId = input.capaId?.trim() ? input.capaId.trim() : null;
    const capaScopeKey = buildCapaScopeKey(capaId);

    const petroleo = input.petroleo ?? null;
    const agua = input.agua ?? null;
    const gas = input.gas ?? null;
    const inyeccionGas = input.inyeccionGas ?? null;
    const inyeccionAgua = input.inyeccionAgua ?? null;

    await databaseService.run(
      `INSERT INTO ValorEscenario (
        id, escenarioId, pozoId, capaId, capaScopeKey, fecha,
        petroleo, agua, gas, inyeccionGas, inyeccionAgua,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (escenarioId, pozoId, capaScopeKey, fecha)
      DO UPDATE SET
        capaId = EXCLUDED.capaId,
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
        capaId,
        capaScopeKey,
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

    const rows = await databaseService.readAll(
      `SELECT id, escenarioId, pozoId, capaId, fecha,
              petroleo, agua, gas, inyeccionGas, inyeccionAgua,
              createdAt, updatedAt
       FROM ValorEscenario
       WHERE escenarioId = ?
         AND pozoId = ?
         AND capaScopeKey = ?
         AND fecha = ?
       LIMIT 1`,
      [input.escenarioId, input.pozoId, capaScopeKey, input.fecha],
    );

    if (rows.length === 0) {
      throw new Error("ValorEscenario upsert failed");
    }

    return mapValorEscenario(rows[0]);
  }

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
