/**
 * Run every problem's solutionSql against the Example test case (and note
 * interesting hidden tests) and print results for explanation writing.
 */
import initSqlJs from 'sql.js';
import { loadProblems } from '../server/load-problems.js';

const SQL = await initSqlJs();
const problems = await loadProblems();

for (const p of problems) {
  if (p.number > 90) continue;

  const example = p.tests?.[0] ?? { name: 'Example', seedSql: '' };

  try {
    const db = new SQL.Database();
    db.run(p.schemaSql);
    if (example.seedSql) db.run(example.seedSql);

    const out = db.exec(p.solutionSql);
    const rows = out.length ? out[out.length - 1].values : [];
    const cols = out.length ? out[out.length - 1].columns : [];
    db.close();

    const fmt = rows.map(r => JSON.stringify(r)).join('; ');
    console.log(`${p.number}|${p.id}|${p.title}|${cols.join(',')}|${rows.length}|${fmt}`);
  } catch (err) {
    console.log(`${p.number}|${p.id}|${p.title}|ERROR|${err.message}`);
  }
}
