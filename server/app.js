import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProblems } from './load-problems.js';
import { createStore } from './store.js';

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
  res.json(await store.readUserBucket('submissions', req.query.user));
});

// Body: { user, date }
app.post('/api/submissions', async (req, res) => {
  const { user, date } = req.body ?? {};
  if (!date) return res.status(400).json({ error: 'date is required' });

  const subs = await store.readUserBucket('submissions', user);
  subs[date] = (subs[date] ?? 0) + 1;
  await store.writeUserBucket('submissions', user, subs);
  res.json({ date, count: subs[date] });
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
