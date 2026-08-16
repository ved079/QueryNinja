/**
 * Canonical form helpers for HMAC-based answer verification.
 *
 * SERVER-ONLY — never import this from anything under web/src.
 * The HMAC secret (EXPECTED_HASH_SECRET) stays server-side; this module
 * never appears in the Vite client bundle because nothing in web/ imports it.
 *
 * Design: a "correct" submission produces actual rows that equal expectedOutput.
 * We canonicalize both to the same stable string and HMAC them.  An attacker
 * who sees expectedOutput in /api/problem/:id cannot forge a matching HMAC
 * without the secret key.
 */
import { createHmac } from 'node:crypto';

/** null/undefined stays null; everything else becomes its string representation. */
function normalizeValue(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

/**
 * Produce a stable object from a plain object row:
 *  - lowercase every key
 *  - sort keys alphabetically (so {b,a} and {a,b} produce the same JSON)
 *  - normalize every value
 */
function normalizeRow(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => [k.toLowerCase(), normalizeValue(v)])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/**
 * Canonical string for an array-of-arrays result (what the client sends as
 * caseResults[i].actual: { columns: string[], rows: any[][] }).
 */
export function canonicalize(columns, rows) {
  const lowerCols = columns.map((c) => c.toLowerCase());
  const objects = rows.map((row) =>
    normalizeRow(Object.fromEntries(lowerCols.map((col, i) => [col, row[i]])))
  );
  objects.sort((a, b) => {
    const ja = JSON.stringify(a);
    const jb = JSON.stringify(b);
    return ja < jb ? -1 : ja > jb ? 1 : 0;
  });
  return JSON.stringify(objects);
}

/**
 * Canonical string for an array-of-objects (expectedOutput from problem JSON).
 * Must produce the same output as canonicalize() when given an equivalent result.
 */
export function canonicalizeObjects(objArray) {
  const objects = (objArray ?? []).map(normalizeRow);
  objects.sort((a, b) => {
    const ja = JSON.stringify(a);
    const jb = JSON.stringify(b);
    return ja < jb ? -1 : ja > jb ? 1 : 0;
  });
  return JSON.stringify(objects);
}

/** HMAC-SHA256 of a canonical string using the server secret. */
export function hmacHex(canonical, secret) {
  return createHmac('sha256', secret).update(canonical).digest('hex');
}
