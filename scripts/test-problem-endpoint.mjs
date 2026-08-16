/**
 * F-5 integration test: GET /api/problem/:id access control.
 *
 * Run: node scripts/test-problem-endpoint.mjs
 *
 * Starts the Express app against a throw-away file store in a temp directory,
 * then verifies three scenarios:
 *   (a) unauthenticated — no token → 401
 *   (b) authenticated, unsolved — valid token, no progress → 200 but no solution fields
 *   (c) authenticated, solved — valid token, progress.status==='solved' → 200 with solution fields
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

// ─── Isolated temp store ──────────────────────────────────────────────────────
// Set DATA_DIR before importing the app so the file-backed store lands in a
// temp directory that gets cleaned up after the test. Dynamic import ensures
// the env var is visible when app.js initialises its module-level store.
const tmpDir = await mkdtemp(path.join(tmpdir(), 'queryninja-test-'));
process.env.DATA_DIR = tmpDir;
process.env.EXPECTED_HASH_SECRET = ''; // disable HMAC — we inject solved status directly

const { app } = await import('../server/app.js');
// Import the store separately so we can write tokens and progress directly
// without going through the API (which would require HMAC-verified submissions).
const { createStore, userKey } = await import('../server/store.js');
const store = createStore(tmpDir);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function get(path, { token, user } = {}) {
  const url = new URL(path, base);
  if (user !== undefined) url.searchParams.set('user', user);
  const headers = {};
  if (token) headers['X-User-Token'] = token;
  return fetch(url.toString(), { headers });
}

// Find a real problem ID to use across all three tests.
const listRes = await fetch(`${base}/api/problems`);
const problems = await listRes.json();
assert.ok(problems.length > 0, 'expected at least one problem in the list');
const problemId = problems[0].id;

// ─── Set up a named test user ─────────────────────────────────────────────────
const username = 'testuser-' + randomBytes(4).toString('hex');
const token = randomBytes(32).toString('hex');
await store.setUserToken(userKey(username), token);

// ─── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✓  ${name}`);
    passed++;
  }).catch((err) => {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  });
}

// ─── (a) Unauthenticated — no token ──────────────────────────────────────────
await test('(a) unauthenticated: GET /api/problem/:id with no token → 401', async () => {
  const res = await get(`/api/problem/${encodeURIComponent(problemId)}`, { user: username });
  assert.equal(res.status, 401, `expected 401, got ${res.status}`);
  const body = await res.json();
  assert.ok(body.error, 'expected an error message in the body');
});

// ─── (b) Authenticated, unsolved ─────────────────────────────────────────────
await test('(b) authenticated unsolved: 200 but no solutionSql / hint / outputExplanation', async () => {
  const res = await get(`/api/problem/${encodeURIComponent(problemId)}`, { user: username, token });
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.id, problemId, 'problem id should match');
  assert.ok(body.schemaSql !== undefined || body.prompt !== undefined, 'public fields should be present');
  assert.equal(body.solutionSql, undefined, 'solutionSql must not be present for unsolved user');
  assert.equal(body.hint, undefined, 'hint must not be present for unsolved user');
  assert.equal(body.outputExplanation, undefined, 'outputExplanation must not be present for unsolved user');
});

// ─── (c) Authenticated, solved ────────────────────────────────────────────────
// Inject solved status directly into the store (bypasses HMAC so the test
// is self-contained without needing a real expected-hash secret).
await store.writeUserBucket('progress', username, {
  [problemId]: { status: 'solved', solvedAt: new Date().toISOString() },
});

await test('(c) authenticated solved: 200 with solutionSql present', async () => {
  const res = await get(`/api/problem/${encodeURIComponent(problemId)}`, { user: username, token });
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.id, problemId, 'problem id should match');
  // solutionSql is always authored in the problem JSON; its presence confirms
  // the server is now including solution fields for this solved user.
  assert.notEqual(body.solutionSql, undefined, 'solutionSql must be present for solved user');
});

// ─── Sibling-pattern check ────────────────────────────────────────────────────
// Verify the list endpoint still strips solution fields (regression guard).
await test('sibling: GET /api/problems list never leaks solutionSql', async () => {
  const res = await fetch(`${base}/api/problems`);
  assert.equal(res.status, 200);
  const list = await res.json();
  for (const p of list) {
    assert.equal(p.solutionSql, undefined, `solutionSql leaked for problem ${p.id}`);
    assert.equal(p.hint, undefined, `hint leaked for problem ${p.id}`);
    assert.equal(p.outputExplanation, undefined, `outputExplanation leaked for problem ${p.id}`);
  }
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────
await new Promise((resolve) => server.close(resolve));
await rm(tmpDir, { recursive: true, force: true });

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
