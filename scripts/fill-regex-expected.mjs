/**
 * Fill expectedOutput for the REGEXP problems (178+) by running the solution
 * through sql.js with the regex helper functions registered.
 *
 *   node scripts/fill-regex-expected.mjs
 */
import initSqlJs from 'sql.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerRegex } from '../web/src/lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'problems');

const SQL = await initSqlJs();

function runQuery(schemaSql, seedSql, querySql) {
  const db = new SQL.Database();
  registerRegex(db);
  db.run(schemaSql);
  if (seedSql) db.run(seedSql);
  const result = db.exec(querySql);
  db.close();
  if (!result.length) return [];
  const { columns, values } = result[result.length - 1];
  return values.map((row) =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]]))
  );
}

const files = (await fs.readdir(OUT))
  .filter((f) => /^\d+-regex-/.test(f) && f.endsWith('.json'))
  .sort();

for (const file of files) {
  const p = JSON.parse(await fs.readFile(path.join(OUT, file), 'utf8'));
  const tests = p.tests.map((t) => ({
    ...t,
    expectedOutput: runQuery(p.schemaSql, t.seedSql, p.solutionSql),
  }));
  await fs.writeFile(path.join(OUT, file), JSON.stringify({ ...p, tests }, null, 2) + '\n', 'utf8');
  const sizes = tests.map((t) => t.expectedOutput.length);
  console.log(`${p.number} ${p.id.padEnd(28)} rows/case → [${sizes.join(', ')}]`);
}