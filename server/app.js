import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt, createHash, randomBytes } from 'node:crypto';
import { loadProblems } from './load-problems.js';
import { createStore, hasRedisEnv, userKey } from './store.js';
import { sendOtpEmail } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// Only used by the file-backed store (local dev, Fly.io). On Vercel the
// Redis-backed store is picked automatically instead — see store.js.
const DATA_DIR = process.env.DATA_DIR || ROOT;
const distDir = path.join(ROOT, 'dist');

const store = createStore(DATA_DIR);

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
    const sanitized = all.map(({ solutionSql, outputExplanation, hint, ...rest }) => rest);
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Returns the full problem (including solutionSql) for a single problem.
// Needed by the client for client-side grading (sql.js WASM) and expected
// output computation. The bulk /api/problems endpoint never leaks these.
app.get('/api/problem/:id', async (req, res) => {
  try {
    const all = await loadProblems();
    const problem = all.find((p) => p.id === req.params.id);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });
    res.json(problem);
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
    res.status(401).json({ error: 'Missing or invalid session token. Please log in or set your name again.' });
    return false;
  }
  const stored = await store.getUserToken(name);
  if (!stored || stored !== token) {
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
  if (rec.lockedUntil > now) return 'Too many failed attempts. Try again later.';
  if (rec.otpCount >= OTP_MAX_PER_HOUR) return 'Too many OTP requests. Try again later.';
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
  if (rec.failed > OTP_MAX_FAILURES) {
    rec.lockedUntil = now + OTP_LOCK_MS;
    rec.failed = 0;
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  res.json({ ok: true, pendingVerification: true });
});

app.get('/api/auth/email', async (req, res) => {
  const user = req.query.user;
  if (!user) return res.status(400).json({ error: 'user is required' });
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
  const progress = await store.readUserBucket('progress', req.query.user);
  res.json(await attachSolutions(progress));
});

// Body: { user, id, status: "solved" | "attempted", code }
app.post('/api/progress', async (req, res) => {
  const { user, id, status, code } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });
  if (!(await requireUser(req, res, user))) return;

  const progress = await store.readUserBucket('progress', user);
  const prev = progress[id] ?? {};
  progress[id] = {
    ...prev,
    // Once solved, stay solved.
    status: prev.status === 'solved' ? 'solved' : status ?? prev.status,
    code: code ?? prev.code,
    solvedAt: status === 'solved' ? prev.solvedAt ?? new Date().toISOString() : prev.solvedAt,
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
  let subs = await store.readUserBucket('submissions', req.query.user);
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

// Body: { user, problemId, code, status }
app.post('/api/submissions', async (req, res) => {
  const { user, problemId, code, status } = req.body ?? {};
  if (!problemId) return res.status(400).json({ error: 'problemId is required' });
  if (!(await requireUser(req, res, user))) return;

  let subs = await store.readUserBucket('submissions', user);
  if (!Array.isArray(subs)) subs = []; // discard legacy flat format
  const entry = {
    id: crypto.randomUUID(),
    problemId,
    code: code ?? null,
    status: status ?? 'attempted',
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
