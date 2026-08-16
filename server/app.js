import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt, createHash, randomBytes } from 'node:crypto';
import { loadProblems } from './load-problems.js';
import { createStore, hasRedisEnv, userKey } from './store.js';
import { sendOtpEmail } from './mailer.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _tokenRatelimit;
const getTokenRatelimit = () => {
  if (!_tokenRatelimit && hasRedisEnv()) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
    });
    _tokenRatelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') });
  }
  return _tokenRatelimit;
};
import { canonicalize, hmacHex } from './canon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// Only used by the file-backed store (local dev, Fly.io). On Vercel the
// Redis-backed store is picked automatically instead — see store.js.
const DATA_DIR = process.env.DATA_DIR || ROOT;
const distDir = path.join(ROOT, 'dist');

const store = createStore(DATA_DIR);

// Server-only secret for HMAC answer verification (see server/canon.js).
// If missing, the server still runs but can never grant "solved" status via
// hash verification — all submissions are stored as "attempted".
const HASH_SECRET = process.env.EXPECTED_HASH_SECRET ?? '';
if (!HASH_SECRET) {
  console.warn('[canon] EXPECTED_HASH_SECRET is not set — answer verification disabled. Set it and re-run hash-expected-outputs.mjs before deploying.');
}

export const app = express();

app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json());

// ─── CORS: only our own domains, never *. Also the only place the origin
// echo is set — a non-allowed origin gets no Access-Control-Allow-Origin,
// so the browser blocks the response.
const ALLOWED_ORIGINS = new Set([
  'https://queryninja.vercel.app',
  'http://localhost:5173',
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-User-Token');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Security headers on every response. unsafe-inline/unsafe-eval are
// required by the SQL WASM bundle; the Google font origins by the UI font.
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'"
  );
  next();
});

// Problems are re-read on every request so you can add/edit JSON files
// without restarting the server. Never expose solutionSql/outputExplanation
// or hints publicly — those are only sent on solve or via the progress
// endpoint.
app.get('/api/problems', async (_req, res) => {
  try {
    const all = await loadProblems();
    const sanitized = all.map(({ solutionSql, outputExplanation, hint, tests, ...rest }) => ({
      ...rest,
      tests: (tests ?? []).map(({ expectedOutput, expectedHash, ...t }) => t),
    }));
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Returns the problem for a single ID. solutionSql, hint, and outputExplanation
// are only included when the requesting user has solved this problem — they are
// never sent to unauthenticated or unsolved callers.
app.get('/api/problem/:id', async (req, res) => {
  const user = req.query.user;
  if (!(await requireUser(req, res, user))) return;
  try {
    const all = await loadProblems();
    const problem = all.find((p) => p.id === req.params.id);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });
    const progress = await store.readUserBucket('progress', user);
    const solved = progress[req.params.id]?.status === 'solved';
    if (solved) return res.json(problem);
    const { solutionSql, hint, outputExplanation, ...rest } = problem;
    res.json(rest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEMPORARY — remove once the Redis env var mismatch is diagnosed. Only
// reports which env var *names* exist, never their values.
app.get('/api/_debug/store', (_req, res) => {
  res.json({
    hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    hasKvUrl: !!process.env.KV_REST_API_URL,
    hasKvToken: !!process.env.KV_REST_API_TOKEN,
    hasRedisEnv: hasRedisEnv(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
});

// ─── Auth helpers ─────────────────────────────────────────────────────────
const TOKEN_HEX = /^[0-9a-f]{64}$/;
const isToken = (t) => typeof t === 'string' && TOKEN_HEX.test(t);

const USERNAME_RE = /^[a-zA-Z0-9 _-]{1,24}$/;
const RESERVED_NAMES = new Set(['admin', 'root', 'system', 'null', 'undefined', 'api', 'auth', 'user', 'server', 'moderator']);
/** Returns an error string if the username is invalid, otherwise null. */
function validateUsername(user) {
  if (!user || typeof user !== 'string') return 'user is required';
  const t = user.trim();
  if (!t) return 'user is required';
  if (RESERVED_NAMES.has(t.toLowerCase())) return 'Username must be 1–24 characters: letters, numbers, spaces, hyphens, or underscores';
  if (!USERNAME_RE.test(t)) return 'Username must be 1–24 characters: letters, numbers, spaces, hyphens, or underscores';
  return null;
}

/** In-memory lock to prevent concurrent token creation for the same name. */
const creationLocks = new Set();

const getHeaderToken = (req) => String(req.headers['x-user-token'] ?? '').trim();

/**
 * Verify that the request's X-User-Token belongs to the named user.
 * Writes the 401/403 response itself and returns false when it fails.
 */
const audit = (event, detail = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...detail }));

async function requireUser(req, res, user) {
  const formatErr = validateUsername(user);
  if (formatErr) {
    res.status(400).json({ error: formatErr });
    return false;
  }
  const name = userKey(user);
  const token = getHeaderToken(req);
  // The shared anonymous bucket ("use without a username") is public by
  // design — no session needed. Every named user must present their token.
  if (name === 'anonymous') return true;
  if (!isToken(token)) {
    audit('auth.missing_token', { user: name, path: req.path, method: req.method });
    res.status(401).json({ error: 'Missing or invalid session token. Please log in or set your name again.' });
    return false;
  }
  const stored = await store.getUserToken(name);
  if (!stored || stored !== token) {
    audit('auth.token_mismatch', { user: name, path: req.path, method: req.method });
    res.status(403).json({ error: 'Session token does not match this user.' });
    return false;
  }
  return true;
}

/** Create (and persist) a fresh session token for a user, e.g. after OTP login. */
const issueToken = async (user) => {
  const token = randomBytes(32).toString('hex');
  await store.setUserToken(userKey(user), token);
  return token;
};

// Body: { user } — mints a session token for a brand-new name-only user
// (the "set name" flow, before any email is linked). If the name already has
// a token (someone already claimed a session for it), the caller must prove
// they hold that token to keep using it — otherwise they must log in via the
// linked email to take the name over.
app.post('/api/auth/token', async (req, res) => {
  const rl = getTokenRatelimit();
  if (rl) {
    const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const { success } = await rl.limit(`token:${ip}`);
    if (!success) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
  const user = (req.body?.user ?? '').trim();
  const fmtErr = validateUsername(user);
  if (fmtErr) return res.status(400).json({ error: fmtErr });
  const name = userKey(user);
  if (name === 'anonymous') return res.status(400).json({ error: 'The anonymous bucket does not need a session token.' });

  const existing = await store.getUserToken(name);
  if (existing) {
    if (getHeaderToken(req) === existing) return res.json({ ok: true, token: existing });
    return res.status(403).json({ error: 'This name already has an active session. Log in with its linked email to take it over.' });
  }

  // Lock to prevent two concurrent requests both seeing no existing token and
  // both minting a new one — the second writer would silently overwrite the first.
  if (creationLocks.has(name)) {
    return res.status(409).json({ error: 'A session is already being created for this name. Try again in a moment.' });
  }
  creationLocks.add(name);
  try {
    // Re-check under the lock in case another request just wrote one.
    const raceCheck = await store.getUserToken(name);
    if (raceCheck) {
      if (getHeaderToken(req) === raceCheck) return res.json({ ok: true, token: raceCheck });
      return res.status(403).json({ error: 'This name already has an active session. Log in with its linked email to take it over.' });
    }
    const token = await issueToken(name);
    res.json({ ok: true, token });
  } finally {
    creationLocks.delete(name);
  }
});

// ─── OTP rate limiter (Issue 4) ────────────────────────────────────────────
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const OTP_MAX_PER_HOUR = 5;
const OTP_MAX_FAILURES = 10;
const OTP_LOCK_MS = 15 * 60 * 1000; // 15 minutes
const rateLimits = new Map();

const rateKey = (email) => email.trim().toLowerCase();

/** Returns null if allowed, or the 429 error message if blocked. */
function checkOtpRequestLimit(email) {
  const now = Date.now();
  const rec = rateLimits.get(rateKey(email)) ?? { windowStart: now, otpCount: 0, failed: 0, lockedUntil: 0 };
  if (now - rec.windowStart > RATE_WINDOW_MS) {
    rec.windowStart = now;
    rec.otpCount = 0;
  }
  if (rec.lockedUntil > now) {
    audit('otp.rate_limited', { email: rateKey(email), reason: 'locked' });
    return 'Too many failed attempts. Try again later.';
  }
  if (rec.otpCount >= OTP_MAX_PER_HOUR) {
    audit('otp.rate_limited', { email: rateKey(email), reason: 'hourly_cap' });
    return 'Too many OTP requests. Try again later.';
  }
  rec.otpCount++;
  rateLimits.set(rateKey(email), rec);
  return null;
}

/** Returns null if allowed, or the 429 error message if blocked. */
function checkOtpVerifyLimit(email) {
  const now = Date.now();
  const rec = rateLimits.get(rateKey(email)) ?? { windowStart: now, otpCount: 0, failed: 0, lockedUntil: 0 };
  if (rec.lockedUntil > now) return 'Too many failed attempts. Try again later.';
  rateLimits.set(rateKey(email), rec);
  return null;
}

function recordOtpFailure(email) {
  const now = Date.now();
  const rec = rateLimits.get(rateKey(email)) ?? { windowStart: now, otpCount: 0, failed: 0, lockedUntil: 0 };
  if (rec.lockedUntil > now) return;
  rec.failed++;
  audit('otp.verify_failed', { email: rateKey(email), failCount: rec.failed });
  if (rec.failed > OTP_MAX_FAILURES) {
    rec.lockedUntil = now + OTP_LOCK_MS;
    rec.failed = 0;
    audit('otp.account_locked', { email: rateKey(email), lockUntil: new Date(rec.lockedUntil).toISOString() });
  }
  rateLimits.set(rateKey(email), rec);
}

function resetOtpFailures(email) {
  const rec = rateLimits.get(rateKey(email));
  if (rec) {
    rec.failed = 0;
    rateLimits.set(rateKey(email), rec);
  }
}

// Periodically drop stale rate-limit entries older than an hour.
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of rateLimits) {
    if (now - rec.windowStart > RATE_WINDOW_MS && rec.lockedUntil < now) {
      rateLimits.delete(key);
    }
  }
}, 10 * 60 * 1000).unref?.();

// ─── Username endpoint ─────────────────────────────────────────────────────

// Query: ?name=foo&current=bar (current = the user's own existing name, if
// any, so re-saving your own name — or just changing its casing — never
// reads as "taken").
app.get('/api/username-available', async (req, res) => {
  const name = (req.query.name ?? '').trim();
  if (!name) return res.json({ available: false, reason: 'empty' });
  if (!/^[a-zA-Z0-9 _-]{1,24}$/.test(name)) {
    return res.json({ available: false, reason: 'invalid' });
  }
  const taken = await store.isUsernameTaken(name, req.query.current);
  res.json({ available: !taken, reason: taken ? 'taken' : null });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_SECONDS = 10 * 60;
const hashOtp = (code) => createHash('sha256').update(code).digest('hex');

// Body: { user, email } — starts the "link an email to my username" flow.
// Does NOT link the email yet: it validates ownership by emailing a code
// (exactly like request-otp) and returns pendingVerification. The email is
// only actually linked by verify-otp once the code checks out. Refuses to
// steal an email that's already linked to a *different* username.
app.post('/api/auth/link-email', async (req, res) => {
  const user = (req.body?.user ?? '').trim();
  const email = (req.body?.email ?? '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'user and email are required' });
  const fmtErr = validateUsername(user);
  if (fmtErr) return res.status(400).json({ error: fmtErr });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'That email address looks invalid.' });
  if (!(await requireUser(req, res, user))) return;

  const existingOwner = await store.getUsernameForEmail(email);
  if (existingOwner && existingOwner.toLowerCase() !== user.toLowerCase()) {
    return res.status(409).json({ error: 'That email is already linked to a different username.' });
  }

  const tooMany = checkOtpRequestLimit(email);
  if (tooMany) return res.status(429).json({ error: tooMany });

  const code = String(randomInt(100000, 1000000));
  await store.setOtp(email, {
    codeHash: hashOtp(code),
    username: userKey(user),
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  });
  try {
    await sendOtpEmail(email, code);
  } catch {
    return res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
  res.json({ ok: true, pendingVerification: true });
});

app.get('/api/auth/email', async (req, res) => {
  const user = req.query.user;
  if (!(await requireUser(req, res, user))) return;
  res.json({ email: (await store.getEmailForUsername(user)) ?? null });
});

// Body: { email } — sends a 6-digit code to the email if (and only if) it's
// linked to a username. Doesn't reveal whether the email exists at all in
// the response, beyond the generic "check your inbox" framing on the client.
app.post('/api/auth/request-otp', async (req, res) => {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });

  const tooMany = checkOtpRequestLimit(email);
  if (tooMany) return res.status(429).json({ error: tooMany });

  const username = await store.getUsernameForEmail(email);
  if (!username) return res.status(404).json({ error: 'No account is linked to that email.' });

  const code = String(randomInt(100000, 1000000));
  await store.setOtp(email, { codeHash: hashOtp(code), username, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 }, OTP_TTL_SECONDS);
  try {
    await sendOtpEmail(email, code);
  } catch {
    return res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
  res.json({ ok: true });
});

// Body: { email, code, user? } — on success returns the username this email
// is linked to (and a fresh session token): the client then logs in as that
// username locally. If `user` is supplied and the OTP is valid, the email is
// (finally) linked to that user account — this is the only place linking
// actually happens.
app.post('/api/auth/verify-otp', async (req, res) => {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  const code = (req.body?.code ?? '').trim();
  const requestedUser = (req.body?.user ?? '').trim();
  if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

  const blocked = checkOtpVerifyLimit(email);
  if (blocked) return res.status(429).json({ error: blocked });

  const record = await store.getOtp(email);
  if (!record || record.codeHash !== hashOtp(code)) {
    recordOtpFailure(email);
    return res.status(400).json({ error: 'That code is invalid or expired.' });
  }

  resetOtpFailures(email);
  await store.clearOtp(email);

  // Final step of the link-email flow: only now bind the email to the user.
  if (requestedUser) {
    if (record.username && record.username.toLowerCase() !== requestedUser.toLowerCase()) {
      return res.status(400).json({ error: 'Wrong account for this code.' });
    }
    await store.setUserEmail(requestedUser, email);
    const token = await issueToken(requestedUser);
    return res.json({ ok: true, username: requestedUser, email, token, pendingVerification: false });
  }

  const username = record.username;
  const token = await issueToken(username);
  res.json({ username, token });
});

// Writes solution/hint/outputExplanation into solved progress entries so the
// client can show them without exposing them in the public problems list.
async function attachSolutions(progress) {
  const solvedIds = Object.entries(progress)
    .filter(([, v]) => v?.status === 'solved')
    .map(([id]) => id);
  if (!solvedIds.length) return progress;
  const all = await loadProblems();
  const byId = Object.fromEntries(all.map((p) => [p.id, p]));
  for (const id of solvedIds) {
    const p = byId[id];
    if (!p) continue;
    progress[id] = {
      ...progress[id],
      solutionSql: p.solutionSql,
      hint: p.hint,
      outputExplanation: p.outputExplanation,
    };
  }
  return progress;
}

app.get('/api/progress', async (req, res) => {
  const user = req.query.user;
  if (!(await requireUser(req, res, user))) return;
  const progress = await store.readUserBucket('progress', user);
  res.json(await attachSolutions(progress));
});

// Body: { user, id, code, caseResults }
// caseResults: Array<{ actual: { columns: string[], rows: any[][] } | null }>
//
// The server determines pass/fail itself by HMAC-verifying the submitted rows
// against the pre-computed expectedHash stored in each problem's test case.
// The client never sends a status field — the server is the sole authority.
app.post('/api/progress', async (req, res) => {
  const { user, id, code, caseResults } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });
  if (!(await requireUser(req, res, user))) return;

  // Load the problem to get per-test expectedHash values.
  const all = await loadProblems();
  const problem = all.find((p) => p.id === id);

  // Guard against DoS via giant caseResults payloads. Limits are generous
  // enough for any real problem (max ~30 test cases, each returning ≤1000 rows
  // from the client-side sandbox) but block abuse.
  const MAX_CASE_RESULTS = 50;
  const MAX_ROWS_PER_CASE = 1100; // slightly above the client 1000-row cap
  const MAX_COLS_PER_CASE = 50;
  if (Array.isArray(caseResults)) {
    if (caseResults.length > MAX_CASE_RESULTS) {
      return res.status(400).json({ error: 'Too many case results.' });
    }
    for (const cr of caseResults) {
      if (!cr?.actual) continue;
      if (Array.isArray(cr.actual.columns) && cr.actual.columns.length > MAX_COLS_PER_CASE) {
        return res.status(400).json({ error: 'Too many columns in case result.' });
      }
      if (Array.isArray(cr.actual.rows) && cr.actual.rows.length > MAX_ROWS_PER_CASE) {
        return res.status(400).json({ error: 'Too many rows in case result.' });
      }
    }
  }

  // Server-side pass/fail: compare HMAC of submitted rows against stored hash.
  // Falls back to 'attempted' if the secret is missing, the problem is unknown,
  // or any test case's hash doesn't match.
  let serverStatus = 'attempted';
  if (HASH_SECRET && problem && Array.isArray(caseResults) && caseResults.length > 0) {
    const tests = problem.tests ?? [];
    if (tests.length > 0 && caseResults.length >= tests.length) {
      const allPass = tests.every((test, i) => {
        const cr = caseResults[i];
        if (!test.expectedHash) return false; // hash not yet generated
        if (!cr?.actual?.columns || !Array.isArray(cr.actual.rows)) return false;
        const actualHash = hmacHex(canonicalize(cr.actual.columns, cr.actual.rows), HASH_SECRET);
        const match = actualHash === test.expectedHash;
        if (!match) audit('grade.hash_mismatch', { user: userKey(user), problemId: id, testIndex: i });
        return match;
      });
      if (allPass) serverStatus = 'solved';
    }
  }

  const progress = await store.readUserBucket('progress', user);
  const prev = progress[id] ?? {};
  // Once stored as solved, stay solved — a correct submission is permanent.
  const newStatus = prev.status === 'solved' ? 'solved' : serverStatus;
  progress[id] = {
    ...prev,
    status: newStatus,
    code: code ?? prev.code,
    solvedAt: newStatus === 'solved' ? (prev.solvedAt ?? new Date().toISOString()) : prev.solvedAt,
    updatedAt: new Date().toISOString(),
  };
  await store.writeUserBucket('progress', user, progress);
  res.json(await attachSolutions({ [id]: progress[id] }).then((m) => m[id]));
});

app.delete('/api/progress/:id', async (req, res) => {
  const user = req.query.user;
  if (!(await requireUser(req, res, user))) return;
  const progress = await store.readUserBucket('progress', user);
  delete progress[req.params.id];
  await store.writeUserBucket('progress', user, progress);
  res.json({ ok: true });
});

app.post('/api/progress/star', async (req, res) => {
  const { user, id, starred } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });
  if (!(await requireUser(req, res, user))) return;
  const progress = await store.readUserBucket('progress', user);
  const prev = progress[id] ?? {};
  progress[id] = { ...prev, starred: !!starred, updatedAt: new Date().toISOString() };
  await store.writeUserBucket('progress', user, progress);
  res.json(progress[id]);
});

app.get('/api/submissions', async (req, res) => {
  const user = req.query.user;
  if (!(await requireUser(req, res, user))) return;
  let subs = await store.readUserBucket('submissions', user);
  // Migrate legacy flat-object format to array of entries.
  if (!Array.isArray(subs)) {
    subs = Object.entries(subs).flatMap(([date, count]) =>
      Array.from({ length: count }, () => ({
        date,
        code: null,
        problemId: null,
        status: null,
        submittedAt: date,
      }))
    );
  }
  if (req.query.problemId) {
    subs = subs.filter((s) => s.problemId === req.query.problemId);
  }
  res.json(subs);
});

// Body: { user, problemId, code }
// Status is derived from the verified progress bucket (written by POST /api/progress
// which does HMAC verification). The client never dictates its own status here.
app.post('/api/submissions', async (req, res) => {
  const { user, problemId, code } = req.body ?? {};
  if (!problemId) return res.status(400).json({ error: 'problemId is required' });
  if (!(await requireUser(req, res, user))) return;

  // Read progress (written and HMAC-verified by POST /api/progress moments ago).
  const progress = await store.readUserBucket('progress', user);
  const status = progress[problemId]?.status === 'solved' ? 'solved' : 'attempted';

  let subs = await store.readUserBucket('submissions', user);
  if (!Array.isArray(subs)) subs = []; // discard legacy flat format
  const entry = {
    id: crypto.randomUUID(),
    problemId,
    code: code ?? null,
    status,
    submittedAt: new Date().toISOString(),
  };
  subs.push(entry);
  await store.writeUserBucket('submissions', user, subs);
  res.json(entry);
});

app.delete('/api/user', async (req, res) => {
  const user = req.query.user;
  if (!user) return res.status(400).json({ error: 'user is required' });
  if (!(await requireUser(req, res, user))) return;
  await store.writeUserBucket('progress', user, {});
  await store.writeUserBucket('submissions', user, []);
  await store.clearUserToken(user);
  res.json({ ok: true });
});

// Only relevant for the "one process serves everything" deployments (local
// prod build, Fly.io). On Vercel the frontend is built and served by Vercel
// itself — dist/ won't exist inside the serverless function bundle, so this
// is a harmless no-op there; requests never reach it since vercel.json only
// routes /api/* to this app.
app.use(express.static(distDir));
app.get(/^(?!\/api\/).*/, async (_req, res, next) => {
  try {
    await fs.access(path.join(distDir, 'index.html'));
    res.sendFile(path.join(distDir, 'index.html'));
  } catch {
    next();
  }
});
