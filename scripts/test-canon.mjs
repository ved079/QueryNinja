/**
 * Canonicalization correctness tests.
 *
 * Run: node scripts/test-canon.mjs
 *
 * Verifies that canonicalize() (used server-side on client-submitted rows) and
 * canonicalizeObjects() (used in the hashing script on expectedOutput) produce
 * identical HMAC values for correct answers, and different values for wrong ones.
 *
 * Edge cases covered:
 *  1. Basic correct answer (multi-row, with NULLs)
 *  2. Row order invariant — reversed rows must hash the same
 *  3. Numeric value in JSON vs number from sql.js
 *  4. String "200" in expectedOutput vs number 200 from sql.js
 *  5. null value
 *  6. Column name casing (CITY vs city vs City)
 *  7. Key insertion-order invariant ({b,a} vs {a,b})
 *  8. Empty result set
 *  9. Wrong answer must NOT match
 * 10. HMAC is secret-keyed — different secrets produce different digests
 */
import assert from 'node:assert/strict';
import { canonicalize, canonicalizeObjects, hmacHex } from '../server/canon.js';

const SECRET = 'test-secret-not-for-production';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ─── 1. Basic correct answer ──────────────────────────────────────────────────
test('basic correct answer: NULLs and strings', () => {
  const expectedOutput = [
    { firstName: 'Ann', lastName: 'Smith', city: null, state: null },
    { firstName: 'Ben', lastName: 'Jones', city: 'Reno', state: 'Nevada' },
  ];
  const columns = ['firstName', 'lastName', 'city', 'state'];
  const rows    = [['Ann', 'Smith', null, null], ['Ben', 'Jones', 'Reno', 'Nevada']];

  assert.equal(
    hmacHex(canonicalizeObjects(expectedOutput), SECRET),
    hmacHex(canonicalize(columns, rows), SECRET),
  );
});

// ─── 2. Row order invariant ───────────────────────────────────────────────────
test('row order invariant: reversed rows produce same hash', () => {
  const expectedOutput = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Carol' },
  ];
  const columns = ['id', 'name'];
  // Client returns rows in a different order than expectedOutput
  const rows    = [['3', 'Carol'], ['1', 'Alice'], ['2', 'Bob']];

  assert.equal(
    hmacHex(canonicalizeObjects(expectedOutput), SECRET),
    hmacHex(canonicalize(columns, rows), SECRET),
  );
});

// ─── 3. Numeric in JSON (number type) vs number from sql.js ──────────────────
test('numeric value: JSON number 200 vs sql.js number 200', () => {
  const expectedOutput = [{ count: 200 }];   // JSON parses this as JS number
  const columns = ['count'];
  const rows    = [[200]];                   // sql.js also returns a JS number

  assert.equal(
    hmacHex(canonicalizeObjects(expectedOutput), SECRET),
    hmacHex(canonicalize(columns, rows), SECRET),
  );
});

// ─── 4. String "200" in expectedOutput vs number 200 from sql.js ─────────────
test('numeric vs string coercion: "200" and 200 produce same hash', () => {
  const expectedOutput = [{ count: '200' }]; // authored as a string
  const columns = ['count'];
  const rows    = [[200]];                   // sql.js returns a number

  assert.equal(
    hmacHex(canonicalizeObjects(expectedOutput), SECRET),
    hmacHex(canonicalize(columns, rows), SECRET),
  );
});

// ─── 5. null values ───────────────────────────────────────────────────────────
test('null values: {city: null} in expected matches null in actual', () => {
  const expectedOutput = [{ city: null }];
  const columns = ['city'];
  const rows    = [[null]];

  assert.equal(
    hmacHex(canonicalizeObjects(expectedOutput), SECRET),
    hmacHex(canonicalize(columns, rows), SECRET),
  );
});

// ─── 6. Column name casing ────────────────────────────────────────────────────
test('column name casing: CITY, city, City all produce same hash', () => {
  const base  = canonicalizeObjects([{ city: 'Austin' }]);
  const upper = canonicalize(['CITY'], [['Austin']]);
  const mixed = canonicalize(['City'], [['Austin']]);

  assert.equal(hmacHex(base, SECRET), hmacHex(upper, SECRET));
  assert.equal(hmacHex(base, SECRET), hmacHex(mixed, SECRET));
});

// ─── 7. Key insertion-order invariant ─────────────────────────────────────────
test('key order invariant: {b,a} in expected vs {a,b} column order in actual', () => {
  // expectedOutput happens to list keys in a different order than the query's columns
  const expectedOutput = [{ b: '2', a: '1' }];
  const columns = ['a', 'b'];
  const rows    = [['1', '2']];

  assert.equal(
    hmacHex(canonicalizeObjects(expectedOutput), SECRET),
    hmacHex(canonicalize(columns, rows), SECRET),
  );
});

// ─── 8. Empty result set ──────────────────────────────────────────────────────
test('empty result set: both produce the same hash for []', () => {
  assert.equal(
    hmacHex(canonicalizeObjects([]), SECRET),
    hmacHex(canonicalize([], []), SECRET),
  );
});

// ─── 9. Wrong answer must NOT match ───────────────────────────────────────────
test('wrong answer: different values produce different hashes', () => {
  const expectedOutput = [{ name: 'Alice' }];
  const columns = ['name'];
  const wrongRows = [['Bob']];

  assert.notEqual(
    hmacHex(canonicalizeObjects(expectedOutput), SECRET),
    hmacHex(canonicalize(columns, wrongRows), SECRET),
  );
});

// ─── 10. HMAC is secret-keyed ─────────────────────────────────────────────────
test('different secrets produce different HMACs for the same canonical', () => {
  const canonical = canonicalizeObjects([{ x: '1' }]);
  assert.notEqual(hmacHex(canonical, 'secret-a'), hmacHex(canonical, 'secret-b'));
});

// ─── 11. Missing-secret edge case ────────────────────────────────────────────
// Simulates what the server does when EXPECTED_HASH_SECRET is not set.
// The grading block in app.js is gated on `if (HASH_SECRET && ...)`, so an
// empty/missing secret must never accidentally produce a hash that matches the
// stored expectedHash (which was computed with the real secret).
test('missing secret: empty string never matches a hash computed with a real secret', () => {
  const expectedOutput = [{ id: '1', name: 'Alice' }];
  const columns = ['id', 'name'];
  const rows    = [['1', 'Alice']]; // correct answer

  const realHash  = hmacHex(canonicalizeObjects(expectedOutput), SECRET);
  const emptyHash = hmacHex(canonicalize(columns, rows), ''); // empty secret

  // A correct answer hashed with no secret must not equal the stored hash.
  assert.notEqual(emptyHash, realHash);
});

test('missing secret: HMAC with empty string is deterministic but distinct', () => {
  // Two calls with the same empty secret produce the same value (not random),
  // but that value is different from every hash produced with any real secret.
  const canonical = canonicalizeObjects([{ x: '1' }]);
  assert.equal(hmacHex(canonical, ''), hmacHex(canonical, ''));
  assert.notEqual(hmacHex(canonical, ''), hmacHex(canonical, 'any-real-secret'));
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
