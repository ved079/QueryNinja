import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt, createHash } from 'node:crypto';
import { loadProblems } from './load-problems.js';
import { createStore, hasRedisEnv } from './store.js';
import { sendOtpEmail } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// Only used by the file-backed store (local dev, Fly.io). On Vercel the
// Redis-backed store is picked automatically instead — see store.js.
const DATA_DIR = process.env.DATA_DIR || ROOT;
const distDir = path.join(ROOT, 'dist');

const store = createStore(DATA_DIR);

export const app = express();
app.use(cors());
app.use(express.json());

// Problems are re-read on every request so you can add/edit JSON files
// without restarting the server. Never expose solutionSql/outputExplanation
// publicly — those are only sent on solve or via the progress endpoint.
app.get('/api/problems', async (_req, res) => {
  try {
    const all = await loadProblems();
    const sanitized = all.map(({ solutionSql, outputExplanation, ...rest }) => rest);
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

// Body: { user, email } — links an email to a username so it can be used to
// log back in (via OTP) on another device. Refuses to steal an email that's
// already linked to a *different* username.
app.post('/api/auth/link-email', async (req, res) => {
  const user = (req.body?.user ?? '').trim();
  const email = (req.body?.email ?? '').trim().toLowerCase();
  if (!user || !email) return res.status(400).json({ error: 'user and email are required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'That email address looks invalid.' });

  const existingOwner = await store.getUsernameForEmail(email);
  if (existingOwner && existingOwner.toLowerCase() !== user.toLowerCase()) {
    return res.status(409).json({ error: 'That email is already linked to a different username.' });
  }
  await store.setUserEmail(user, email);
  res.json({ ok: true, email });
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

// Body: { email, code } — on success, returns the username this email is
// linked to; the client then logs in as that username locally.
app.post('/api/auth/verify-otp', async (req, res) => {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  const code = (req.body?.code ?? '').trim();
  if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

  const record = await store.getOtp(email);
  if (!record || record.codeHash !== hashOtp(code)) {
    return res.status(400).json({ error: 'That code is invalid or expired.' });
  }
  await store.clearOtp(email);
  res.json({ username: record.username });
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
  const progress = await store.readUserBucket('progress', req.query.user);
  delete progress[req.params.id];
  await store.writeUserBucket('progress', req.query.user, progress);
  res.json({ ok: true });
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
  await store.writeUserBucket('progress', user, {});
  await store.writeUserBucket('submissions', user, []);
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
