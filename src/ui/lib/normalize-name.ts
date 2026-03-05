// src/ui/lib/normalize-name.ts

/**
 * Normaliza un "nombre" para matching (pozos/capas).
 * Objetivo: que nombres equivalentes terminen en la misma key.
 *
 * Ejemplos:
 * - "ABC0019"  -> "abc 19"
 * - "ABC-19"   -> "abc 19"
 * - "PZ-01"    -> "pz 1"
 * - "Acuífero" -> "acuifero"
 */
export function normalizeNameKey(input: string): string {
  const s0 = (input ?? "").trim().toLowerCase();
  if (!s0) return "";

  // diacríticos
  const s1 = s0.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // separadores -> espacio
  const s2 = s1.replace(/[\t\r\n]+/g, " ").replace(/[_\-./\\]+/g, " ");

  // deja solo a-z0-9 y espacios
  const s3 = s2.replace(/[^a-z0-9 ]+/g, " ");

  // colapsa espacios
  const s4 = s3.replace(/\s+/g, " ").trim();
  if (!s4) return "";

  // canonicaliza tokens, y dentro de cada token canonicaliza runs numéricos (quita ceros a la izquierda)
  const tokens = s4.split(" ").filter(Boolean);
  const canonTokens: string[] = [];

  for (const tok of tokens) {
    const parts = tok.match(/[a-z]+|\d+/g) ?? [tok];

    const canonParts = parts.map((p) => {
      if (/^\d+$/.test(p)) {
        const n = Number.parseInt(p, 10);
        return Number.isFinite(n) ? String(n) : p;
      }
      return p;
    });

    canonTokens.push(canonParts.join(""));
  }

  return canonTokens.join(" ").trim();
}

/**
 * Variantes de clave equivalentes para matching.
 * - con espacios
 * - compacta (sin espacios)
 */
export function keysForName(input: string): string[] {
  const k = normalizeNameKey(input);
  if (!k) return [];
  const compact = k.replace(/\s+/g, "");
  return compact !== k ? [k, compact] : [k];
}
