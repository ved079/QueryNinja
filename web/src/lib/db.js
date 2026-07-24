import initSqlJs from 'sql.js';

let sqlPromise = null;

// sql.js is loaded once and reused; the wasm binary is served from /public.
export function loadSql() {
  sqlPromise ??= initSqlJs({ locateFile: (file) => `/${file}` });
  return sqlPromise;
}

/** The problem's test cases; the first one is the worked example shown in the UI. */
export function testsOf(problem) {
  return problem.tests?.length
    ? problem.tests
    : [{ name: 'Example', seedSql: problem.seedSql ?? '' }];
}

/**
 * Build a fresh in-memory database for one test case.
 * Defaults to the first (example) case.
 */
export async function createDb(problem, test = testsOf(problem)[0]) {
  const SQL = await loadSql();
  const db = new SQL.Database();
  db.run(problem.schemaSql);
  if (test?.seedSql) db.run(test.seedSql);
  return db;
}

/**
 * Execute SQL and return the result set of the last statement that produced one.
 * Returns { columns, rows } or null for statements with no output.
 */
export function exec(db, sql) {
  const results = db.exec(sql);
  if (results.length) {
    const last = results[results.length - 1];
    return { columns: last.columns, rows: last.values };
  }
  // db.exec returns nothing for a SELECT that matched no rows, which is a
  // perfectly good (empty) answer — recover the column names via prepare so an
  // empty result is still comparable.
  try {
    const stmt = db.prepare(sql);
    const columns = stmt.getColumnNames();
    stmt.free();
    if (columns.length) return { columns, rows: [] };
  } catch {
    // Not a query (or not preparable on its own) — fall through.
  }
  return null;
}

const norm = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(6);
  if (v instanceof Uint8Array) return `blob:${v.length}`;
  // Numeric strings compare equal to their numeric form ('200' matches 200).
  const s = String(v);
  const n = Number(s);
  return s.trim() !== '' && !Number.isNaN(n) ? norm(n) : s;
};

const rowKey = (row) => JSON.stringify(row.map(norm));

/**
 * Compare a user result against the expected result.
 * Column names are compared case-insensitively; row order is ignored unless
 * the problem declares orderMatters.
 */
export function compare(actual, expected, orderMatters) {
  if (!actual) {
    return { pass: false, reason: 'Your query returned no result set. Did you forget a SELECT?' };
  }

  const a = actual.columns.map((c) => c.toLowerCase());
  const e = expected.columns.map((c) => c.toLowerCase());

  if (a.length !== e.length) {
    return {
      pass: false,
      reason: `Wrong number of columns: expected ${e.length} (${expected.columns.join(', ')}), got ${a.length}.`,
    };
  }
  const mismatch = e.findIndex((name, i) => name !== a[i]);
  if (mismatch !== -1) {
    return {
      pass: false,
      reason: `Column ${mismatch + 1} should be named "${expected.columns[mismatch]}", got "${actual.columns[mismatch]}". Use an alias.`,
    };
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      pass: false,
      reason: `Wrong number of rows: expected ${expected.rows.length}, got ${actual.rows.length}.`,
    };
  }

  const actualKeys = actual.rows.map(rowKey);
  const expectedKeys = expected.rows.map(rowKey);
  if (!orderMatters) {
    actualKeys.sort();
    expectedKeys.sort();
  }
  const bad = expectedKeys.findIndex((k, i) => k !== actualKeys[i]);
  if (bad !== -1) {
    return {
      pass: false,
      reason: orderMatters
        ? `Row ${bad + 1} does not match the expected output.`
        : 'The rows returned do not match the expected output.',
    };
  }
  return { pass: true, reason: 'All rows match the expected output.' };
}

/**
 * Run the user's query against every test case, comparing each against the
 * reference solution on identically seeded data. Stops at the first failure,
 * the way LeetCode reports one failing case.
 *
 * Returns { passed, total, failure } where failure (if any) carries the case
 * name, the input tables, and both result sets so the UI can show the diff.
 */
export async function gradeAll(problem, userSql) {
  const tests = testsOf(problem);

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const userDb = await createDb(problem, test);
    const refDb = await createDb(problem, test);

    try {
      const expected = exec(refDb, problem.solutionSql);
      let actual;
      try {
        actual = exec(userDb, userSql);
      } catch (err) {
        return {
          passed: i,
          total: tests.length,
          failure: {
            index: i,
            name: test.name,
            error: err.message,
            reason: 'Your query failed to execute on this input.',
            tables: describeTables(refDb),
            expected,
          },
        };
      }

      const verdict = compare(actual, expected, problem.orderMatters);
      if (!verdict.pass) {
        return {
          passed: i,
          total: tests.length,
          failure: {
            index: i,
            name: test.name,
            reason: verdict.reason,
            tables: describeTables(refDb),
            expected,
            actual,
          },
        };
      }
    } finally {
      userDb.close();
      refDb.close();
    }
  }

  return { passed: tests.length, total: tests.length, failure: null };
}

/** Read back the seeded contents of every table, for the schema preview. */
export function describeTables(db) {
  const meta = exec(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (!meta) return [];
  return meta.rows.map(([name]) => {
    const data = exec(db, `SELECT * FROM "${name}"`);
    const cols = exec(db, `PRAGMA table_info("${name}")`);
    return {
      name,
      columns: data?.columns ?? cols?.rows.map((r) => r[1]) ?? [],
      rows: data?.rows ?? [],
    };
  });
}
