import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProblems } from './load-problems.js';
import { createStore, hasRedisEnv } from './store.js';

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
// without restarting the server.
app.get('/api/problems', async (_req, res) => {
  try {
    res.json(await loadProblems());
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

app.get('/api/progress', async (req, res) => {
  res.json(await store.readUserBucket('progress', req.query.user));
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
  res.json(progress[id]);
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
