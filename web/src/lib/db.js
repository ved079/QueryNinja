import initSqlJs from 'sql.js';

let sqlPromise = null;

// ─── Query sandbox ────────────────────────────────────────────────────────────

// Standard word-bounded check: used on space-normalised text after literal removal.
const BLOCKED_KEYWORDS = /\b(DROP|ALTER|CREATE|INSERT|UPDATE|DELETE|ATTACH|DETACH|PRAGMA|REPLACE|TRUNCATE|VACUUM|REINDEX|ANALYZE|SAVEPOINT|RELEASE|ROLLBACK|COMMIT|BEGIN)\b/i;
// Prefix-boundary-only check: used on the fully-collapsed (no-whitespace) form to
// catch keywords that straddle a removed comment (e.g. DR/**/OP → DROP when
// whitespace is removed). The leading \b still prevents matching inside an
// identifier (e.g. "dropout" in SELECTdropout_rateFROMt has no \b before d).
// The trailing \b is intentionally absent so DROPTABLEt still matches DROP.
const BLOCKED_KEYWORDS_PREFIX = /\b(DROP|ALTER|CREATE|INSERT|UPDATE|DELETE|ATTACH|DETACH|PRAGMA|REPLACE|TRUNCATE|VACUUM|REINDEX|ANALYZE|SAVEPOINT|RELEASE|ROLLBACK|COMMIT|BEGIN)/i;
// WITH RECURSIVE can loop infinitely; block it outright.
const RECURSIVE_CTE = /\bWITH\s+RECURSIVE\b/i;

/**
 * Strip SQL single-line (--) and block (/* *\/) comments from a query string
 * without touching content inside string literals. Needed so bypass attempts
 * like DR\/**\/OP TABLE or --\nDELETE are caught by the keyword blocklist.
 */
function stripComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'" || sql[i] === '"') {
      const q = sql[i++];
      out += q;
      while (i < sql.length) {
        const c = sql[i++];
        out += c;
        if (c === q && sql[i] !== q) break;
        if (c === q && sql[i] === q) { out += sql[i++]; } // escaped quote
      }
    } else if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += ' '; // replace comment with space so adjacent tokens can't merge
    } else if (sql[i] === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      out += ' '; // replace comment with space so adjacent tokens can't merge
    } else {
      out += sql[i++];
    }
  }
  return out;
}

/**
 * Replace the content of every string literal with a placeholder character
 * so keyword regexes don't match inside quoted strings (e.g. 'DROP TABLE').
 * The surrounding quotes are preserved so splitStatements still works, but
 * the content is neutralised before any keyword check runs.
 */
function stripLiterals(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'" || sql[i] === '"') {
      const q = sql[i++];
      out += q;
      while (i < sql.length) {
        const c = sql[i++];
        if (c === q && sql[i] !== q) break;
        if (c === q && sql[i] === q) { i++; } // skip doubled escape quote
      }
      out += q; // closing quote — content between quotes is dropped
    } else {
      out += sql[i++];
    }
  }
  return out;
}

/**
 * Split a SQL string on unquoted semicolons. Returns individual statement
 * strings so we can detect stacked queries.
 */
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'" || sql[i] === '"') {
      const q = sql[i++];
      cur += q;
      while (i < sql.length) {
        const c = sql[i++];
        cur += c;
        if (c === q && sql[i] !== q) break;
        if (c === q && sql[i] === q) { cur += sql[i++]; }
      }
    } else if (sql[i] === ';') {
      const t = cur.trim();
      if (t) stmts.push(t);
      cur = '';
      i++;
    } else {
      cur += sql[i++];
    }
  }
  const t = cur.trim();
  if (t) stmts.push(t);
  return stmts;
}

const MAX_ROWS = 1000;
const QUERY_TIMEOUT_MS = 5000;

/**
 * Validate a user-supplied query. Returns an error string to display if the
 * query is rejected, or null if it's safe to run.
 *
 * Rules:
 * 1. Only one statement allowed (no stacked queries).
 * 2. No DML/DDL/PRAGMA keywords — SELECT and WITH...SELECT only.
 * 3. WITH RECURSIVE is blocked to prevent runaway CTEs.
 */
export function validateUserQuery(sql) {
  const cleaned = stripComments(sql);
  const stmts = splitStatements(cleaned);

  if (stmts.length === 0) return 'Please enter a query.';
  if (stmts.length > 1) return 'Only one statement is allowed per run. Remove the extra semicolons.';

  // Remove string literal content so keywords inside quoted strings (e.g.
  // SELECT 'DROP TABLE') don't trigger false positives.
  const withoutLiterals = stripLiterals(stmts[0]);

  // Standard space-normalised check (word boundaries on both sides).
  const normalized = withoutLiterals.replace(/\s+/g, ' ');
  if (BLOCKED_KEYWORDS.test(normalized)) {
    const m = normalized.match(BLOCKED_KEYWORDS);
    return `The keyword "${m[0].toUpperCase()}" is not allowed. Only SELECT queries are permitted.`;
  }

  // Collapsed check: remove all whitespace and look for a keyword at a leading
  // word boundary. Catches tokens that were split across a removed comment
  // (e.g. DR/**/OP TABLE t → "DROPTABLEt" collapsed → \bDROP matches).
  // The leading-only \b prevents false positives for identifiers like
  // "dropout_rate" (the 'd' is preceded by a word char — no boundary fires).
  const collapsed = withoutLiterals.replace(/\s/g, '');
  if (BLOCKED_KEYWORDS_PREFIX.test(collapsed)) {
    const m = collapsed.match(BLOCKED_KEYWORDS_PREFIX);
    return `The keyword "${m[1].toUpperCase()}" is not allowed. Only SELECT queries are permitted.`;
  }

  if (RECURSIVE_CTE.test(normalized)) {
    return 'WITH RECURSIVE is not allowed (it can run forever). Use a plain WITH clause instead.';
  }
  return null;
}

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
 *
 * For user-supplied queries pass `isUserQuery: true` to enforce:
 *   - keyword blocklist + single-statement check (via validateUserQuery)
 *   - 5s timeout via progressHandler (interrupts if too slow)
 *   - 1000-row cap on the returned result set
 */
export function exec(db, sql, { isUserQuery = false } = {}) {
  if (isUserQuery) {
    const err = validateUserQuery(sql);
    if (err) {
      // Audit log: blocked queries are logged before they ever reach sql.js.
      console.warn('[sql-sandbox] blocked query:', { reason: err, sql: sql.slice(0, 200) });
      throw new Error(err);
    }
  }

  let timedOut = false;
  let cleanup = () => {};

  if (isUserQuery) {
    const deadline = Date.now() + QUERY_TIMEOUT_MS;
    // progressHandler is called periodically during long scans; returning
    // a truthy value tells sql.js to interrupt the current statement.
    db.create_function('__noop__', () => 0); // ensure wasm bridge is warm
    try {
      db.run('SELECT 1'); // noop to confirm bridge; errors here are harmless
    } catch { /* ignore */ }
    // sql.js exposes interrupt() to halt a running query.
    const interval = setInterval(() => {
      if (Date.now() > deadline) {
        timedOut = true;
        try { db.interrupt?.(); } catch { /* ignore */ }
      }
    }, 100);
    cleanup = () => clearInterval(interval);
  }

  try {
    const results = db.exec(sql);
    if (timedOut) throw new Error('Query timed out after 5 seconds. Simplify your query.');

    if (results.length) {
      const last = results[results.length - 1];
      const rows = isUserQuery ? last.values.slice(0, MAX_ROWS) : last.values;
      const capped = isUserQuery && rows.length < last.values.length;
      return {
        columns: last.columns,
        rows,
        ...(capped ? { capped: true, totalRows: last.values.length } : {}),
      };
    }
    // db.exec returns nothing for a SELECT that matched no rows — recover
    // column names via prepare so an empty result is still comparable.
    try {
      const stmt = db.prepare(sql);
      const columns = stmt.getColumnNames();
      stmt.free();
      if (columns.length) return { columns, rows: [] };
    } catch {
      // Not a query — fall through.
    }
    return null;
  } finally {
    cleanup();
  }
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
        actual = exec(userDb, userSql, { isUserQuery: true });
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
