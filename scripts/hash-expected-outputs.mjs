/**
 * One-time (and re-runnable) script: adds expectedHash to every test case in
 * every problem JSON file.  The hash is HMAC-SHA256(canonical(expectedOutput),
 * EXPECTED_HASH_SECRET), so the server can verify submitted answers without
 * running a SQL engine.
 *
 * Run after adding/editing problems, or after rotating the secret:
 *
 *   EXPECTED_HASH_SECRET=<your-secret> node scripts/hash-expected-outputs.mjs
 *
 * The secret must be the same value set in the Vercel environment variable
 * EXPECTED_HASH_SECRET (never NEXT_PUBLIC_* — it is server-only).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeObjects, hmacHex } from '../server/canon.js';

const SECRET = process.env.EXPECTED_HASH_SECRET;
if (!SECRET || SECRET.length < 16) {
  console.error('EXPECTED_HASH_SECRET must be set and at least 16 characters.');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

const PROBLEMS_DIR = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..', 'problems',
);

const files = (await readdir(PROBLEMS_DIR))
  .filter((f) => f.endsWith('.json'))
  .sort();

let problemsUpdated = 0;
let testsHashed = 0;
let testsSkipped = 0;

for (const file of files) {
  const fullPath = join(PROBLEMS_DIR, file);
  const problem = JSON.parse(await readFile(fullPath, 'utf8'));

  if (!Array.isArray(problem.tests)) {
    testsSkipped++;
    continue;
  }

  let dirty = false;
  for (const test of problem.tests) {
    if (!Array.isArray(test.expectedOutput)) {
      // A test case with no expectedOutput (shouldn't exist in practice) — skip.
      testsSkipped++;
      continue;
    }
    const canonical = canonicalizeObjects(test.expectedOutput);
    test.expectedHash = hmacHex(canonical, SECRET);
    testsHashed++;
    dirty = true;
  }

  if (dirty) {
    await writeFile(fullPath, JSON.stringify(problem, null, 2) + '\n', 'utf8');
    problemsUpdated++;
  }
}

console.log(`Done. ${problemsUpdated} problems updated, ${testsHashed} test cases hashed, ${testsSkipped} skipped.`);
