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

const safeRegex = (pattern) => {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
};

/**
 * Register the regex helpers SQLite doesn't ship by default, so problems can
 * use REGEXP_LIKE(text, pattern) and the x REGEXP pattern operator. SQLite
 * calls a REGEXP function as (pattern, text) — the reverse of REGEXP_LIKE.
 */
export function registerRegex(db) {
  db.create_function('REGEXP', (pattern, text) => {
    const re = safeRegex(pattern);
    return re && text != null ? (re.test(text) ? 1 : 0) : 0;
  });
  db.create_function('REGEXP_LIKE', (text, pattern) => {
    const re = safeRegex(pattern);
    return re && text != null ? (re.test(text) ? 1 : 0) : 0;
  });
}

/**
 * Build a fresh in-memory database for one test case.
 * Defaults to the first (example) case.
 */
export async function createDb(problem, test = testsOf(problem)[0]) {
  const SQL = await loadSql();
  const db = new SQL.Database();
  registerRegex(db);
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

export const rowKey = (row) => JSON.stringify(row.map(norm));

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
 * Cell/row-level diff for highlighting a failing case in the UI. Doesn't
 * duplicate compare()'s pass/fail logic — this is purely about which
 * columns/rows to mark, so it degrades gracefully (no highlights) if the
 * shapes are too different to line up (e.g. mismatched column counts).
 *
 * Returns { columnMismatches, expectedRowStatus, actualRowStatus } where
 * each row status is 'match' | 'diff' (ordered mode) or
 * 'match' | 'missing' | 'extra' (unordered mode, multiset comparison).
 */
export function diffResults(actual, expected, orderMatters) {
  if (!actual || !expected) return null;

  const sameColumnCount = actual.columns.length === expected.columns.length;
  const columnMismatches = expected.columns.map((c, i) =>
    sameColumnCount ? c.toLowerCase() !== String(actual.columns[i] ?? '').toLowerCase() : false
  );

  if (orderMatters) {
    const expectedRowStatus = expected.rows.map((row, i) =>
      i < actual.rows.length && rowKey(actual.rows[i]) === rowKey(row) ? 'match' : 'diff'
    );
    const actualRowStatus = actual.rows.map((row, i) =>
      i < expected.rows.length && rowKey(expected.rows[i]) === rowKey(row) ? 'match' : 'diff'
    );
    return { columnMismatches, expectedRowStatus, actualRowStatus };
  }

  // Unordered: match each expected row against an unused actual row with the
  // same key, so duplicate rows are each matched at most once.
  const actualUsed = new Array(actual.rows.length).fill(false);
  const expectedRowStatus = expected.rows.map((row) => {
    const key = rowKey(row);
    const idx = actual.rows.findIndex((r, i) => !actualUsed[i] && rowKey(r) === key);
    if (idx !== -1) {
      actualUsed[idx] = true;
      return 'match';
    }
    return 'missing';
  });
  const actualRowStatus = actual.rows.map((_, i) => (actualUsed[i] ? 'match' : 'extra'));
  return { columnMismatches, expectedRowStatus, actualRowStatus };
}

/**
 * Run the user's query against every test case, comparing each against the
 * reference solution on identically seeded data. Unlike a fail-fast grader,
 * this runs all cases so every one can be inspected afterward (e.g. by
 * clicking any pass/fail pill in the UI), not just the first failure.
 *
 * Returns { passed, total, firstFailure, cases } where cases[i] carries that
 * case's name, pass/fail, the input tables, and both result sets.
 */
export async function gradeAll(problem, userSql) {
  const tests = testsOf(problem);
  const cases = [];
  let passed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const userDb = await createDb(problem, test);
    const refDb = await createDb(problem, test);

    try {
      const expected = exec(refDb, problem.solutionSql);
      const tables = describeTables(refDb);

      let actual;
      try {
        actual = exec(userDb, userSql);
      } catch (err) {
        cases.push({
          index: i,
          name: test.name,
          pass: false,
          error: err.message,
          reason: 'Your query failed to execute on this input.',
          tables,
          expected,
          actual: null,
        });
        continue;
      }

      const verdict = compare(actual, expected, problem.orderMatters);
      if (verdict.pass) passed++;
      cases.push({
        index: i,
        name: test.name,
        pass: verdict.pass,
        reason: verdict.reason,
        tables,
        expected,
        actual,
      });
    } finally {
      userDb.close();
      refDb.close();
    }
  }

  return {
    passed,
    total: tests.length,
    firstFailure: cases.find((c) => !c.pass) ?? null,
    cases,
  };
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
