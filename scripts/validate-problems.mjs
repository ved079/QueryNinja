/**
 * Check every problem against every one of its test cases:
 *   - schema, seed data and reference solution must all execute
 *   - the solution must be a real query
 *   - at least one case must return rows (otherwise the suite proves nothing)
 *   - ids and numbers must be unique
 *
 *   node scripts/validate-problems.mjs [--quiet]
 */
import initSqlJs from 'sql.js';
import { loadProblems } from '../server/load-problems.js';

const quiet = process.argv.includes('--quiet');
const SQL = await initSqlJs();
const problems = await loadProblems();

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`FAIL  ${msg}`);
};

const seenIds = new Map();
const seenNumbers = new Map();

for (const p of problems) {
  if (seenIds.has(p.id)) fail(`duplicate id "${p.id}"`);
  seenIds.set(p.id, true);
  if (seenNumbers.has(p.number)) fail(`duplicate number ${p.number} (${p.id} and ${seenNumbers.get(p.number)})`);
  seenNumbers.set(p.number, p.id);

  const counts = [];
  for (const [i, test] of p.tests.entries()) {
    try {
      const db = new SQL.Database();
      db.run(p.schemaSql);
      if (test.seedSql) db.run(test.seedSql);

      const out = db.exec(p.solutionSql);
      if (out.length) {
        counts.push(out[out.length - 1].values.length);
      } else {
        const stmt = db.prepare(p.solutionSql);
        const cols = stmt.getColumnNames();
        stmt.free();
        if (!cols.length) throw new Error('solution is not a query');
        counts.push(0);
      }
      db.close();
    } catch (err) {
      fail(`${p.id} case ${i + 1} "${test.name}" → ${err.message}`);
      counts.push('ERR');
    }
  }

  if (counts.every((c) => c === 0)) {
    fail(`${p.id} → every test case returns zero rows; the suite cannot discriminate`);
  }
  if (!quiet) {
    console.log(
      `${String(p.number).padStart(3)} ${p.difficulty.padEnd(6)} ${p.id.padEnd(38)} ` +
        `${p.tests.length} cases → [${counts.join(', ')}]`
    );
  }
}

const byDifficulty = problems.reduce((acc, p) => {
  acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `\n${problems.length} problems — ` +
    Object.entries(byDifficulty)
      .map(([d, n]) => `${d}: ${n}`)
      .join(', ')
);
console.log(failures ? `${failures} problem(s) failed.` : 'All problems and cases valid.');
process.exit(failures ? 1 : 0);
