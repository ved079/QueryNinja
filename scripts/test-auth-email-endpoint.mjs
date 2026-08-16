/**
 * GET /api/auth/email access-control test.
 *
 * Run: node scripts/test-auth-email-endpoint.mjs
 *
 * Verifies that the endpoint requires a valid session token — the email
 * address stored for a user must never be returned to an unauthenticated caller.
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const tmpDir = await mkdtemp(path.join(tmpdir(), 'queryninja-email-test-'));
process.env.DATA_DIR = tmpDir;
process.env.EXPECTED_HASH_SECRET = '';

const { app } = await import('../server/app.js');
const { createStore, userKey } = await import('../server/store.js');
const store = createStore(tmpDir);

const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

// Set up a named user with a token and a linked email written directly to the store.
const username = 'emailtest-' + randomBytes(4).toString('hex');
const token = randomBytes(32).toString('hex');
const linkedEmail = 'test@example.com';
await store.setUserToken(userKey(username), token);
await store.setUserEmail(userKey(username), linkedEmail);

async function get(user, { token: tok } = {}) {
  const url = new URL('/api/auth/email', base);
  if (user !== undefined) url.searchParams.set('user', user);
  const headers = {};
  if (tok) headers['X-User-Token'] = tok;
  return fetch(url.toString(), { headers });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

await test('no user param → 400', async () => {
  const res = await get(undefined);
  assert.equal(res.status, 400);
});

await test('valid user, no token → 401', async () => {
  const res = await get(username);
  assert.equal(res.status, 401, `expected 401, got ${res.status}`);
  const body = await res.json();
  assert.ok(body.error, 'expected error message');
  // Confirm no email string in the response body under any key.
  assert.ok(!JSON.stringify(body).includes('@'), 'email address must not appear in 401 response');
});

await test('valid user, wrong token → 403', async () => {
  const res = await get(username, { token: randomBytes(32).toString('hex') });
  assert.equal(res.status, 403, `expected 403, got ${res.status}`);
  const body = await res.json();
  assert.ok(!JSON.stringify(body).includes('@'), 'email address must not appear in 403 response');
});

await test('valid user, correct token → 200 with email', async () => {
  const res = await get(username, { token });
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.email, linkedEmail, 'should return the linked email for authenticated user');
});

await test('anonymous user (no token required) → 200 with null email', async () => {
  // The anonymous shared bucket is explicitly public; requireUser allows it
  // through without a token. It will never have a linked email.
  const res = await get('anonymous');
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.email, null, 'anonymous user has no linked email');
});

await new Promise((resolve) => server.close(resolve));
await rm(tmpDir, { recursive: true, force: true });

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
