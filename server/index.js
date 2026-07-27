import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProblems } from './load-problems.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// In production this points at a mounted persistent volume so progress
// survives redeploys; locally it defaults to the project root, unchanged.
const DATA_DIR = process.env.DATA_DIR || ROOT;
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
// Deliberately not PORT: some dev launchers inject PORT for the web server.
const PORT = process.env.API_PORT || process.env.PORT || 3001;
const ANON = 'anonymous';

const app = express();
app.use(cors());
app.use(express.json());

// Data is a two-level object: { [userName]: { ...whatever readProgress/
// readSubmissions used to store flat }, ... }. There is no login — the
// "user" is just whatever name someone typed into the name button, sent as
// a query param on reads and a body field on writes. Anyone who knows a
// name can see/edit that name's data; this is deliberately basic, not auth.
const userKey = (name) => (typeof name === 'string' && name.trim() ? name.trim() : ANON);

async function readJsonFile(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

// Before per-user buckets existed, these files were one flat object shared
// by everyone: progress.json had problem-id keys whose values carry a
// `status`; submissions.json had date keys mapping straight to a number.
// Detect that shape so existing data migrates into the anonymous bucket
// instead of silently vanishing the first time this runs.
const isLegacyFlat = (all) =>
  Object.values(all).some((v) => typeof v !== 'object' || v === null || 'status' in v);

async function readUserBucket(file, name) {
  const all = await readJsonFile(file);
  if (isLegacyFlat(all)) return userKey(name) === ANON ? all : {};
  return all[userKey(name)] ?? {};
}

async function writeUserBucket(file, name, bucket) {
  const all = await readJsonFile(file);
  // Migrating out of the legacy flat shape must preserve that data under
  // ANON, not discard it — even when the write triggering the migration
  // belongs to a different (named) user.
  const migrated = isLegacyFlat(all) ? { [ANON]: all } : all;
  migrated[userKey(name)] = bucket;
  await fs.writeFile(file, JSON.stringify(migrated, null, 2));
  return bucket;
}

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
  res.json(await readUserBucket(PROGRESS_FILE, req.query.user));
});

// Body: { user, id, status: "solved" | "attempted", code }
app.post('/api/progress', async (req, res) => {
  const { user, id, status, code } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const progress = await readUserBucket(PROGRESS_FILE, user);
  const prev = progress[id] ?? {};
  progress[id] = {
    ...prev,
    // Once solved, stay solved.
    status: prev.status === 'solved' ? 'solved' : status ?? prev.status,
    code: code ?? prev.code,
    solvedAt: status === 'solved' ? prev.solvedAt ?? new Date().toISOString() : prev.solvedAt,
    updatedAt: new Date().toISOString(),
  };
  await writeUserBucket(PROGRESS_FILE, user, progress);
  res.json(progress[id]);
});

app.delete('/api/progress/:id', async (req, res) => {
  const progress = await readUserBucket(PROGRESS_FILE, req.query.user);
  delete progress[req.params.id];
  await writeUserBucket(PROGRESS_FILE, req.query.user, progress);
  res.json({ ok: true });
});

app.get('/api/submissions', async (req, res) => {
  res.json(await readUserBucket(SUBMISSIONS_FILE, req.query.user));
});

// Body: { user, date }
app.post('/api/submissions', async (req, res) => {
  const { user, date } = req.body ?? {};
  if (!date) return res.status(400).json({ error: 'date is required' });

  const subs = await readUserBucket(SUBMISSIONS_FILE, user);
  subs[date] = (subs[date] ?? 0) + 1;
  await writeUserBucket(SUBMISSIONS_FILE, user, subs);
  res.json({ date, count: subs[date] });
});

// In production there's no separate Vite dev server — this process serves
// the built frontend too, so the whole app is one deployable service.
const distDir = path.join(ROOT, 'dist');
app.use(express.static(distDir));
app.get(/^(?!\/api\/).*/, async (_req, res, next) => {
  try {
    await fs.access(path.join(distDir, 'index.html'));
    res.sendFile(path.join(distDir, 'index.html'));
  } catch {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`sql-leetcode api  →  http://localhost:${PORT}`);
});
