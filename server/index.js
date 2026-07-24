import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProblems } from './load-problems.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PROGRESS_FILE = path.join(ROOT, 'progress.json');
// Deliberately not PORT: some dev launchers inject PORT for the web server.
const PORT = process.env.API_PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());


async function readProgress() {
  try {
    return JSON.parse(await fs.readFile(PROGRESS_FILE, 'utf8'));
  } catch {
    return {};
  }
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

app.get('/api/progress', async (_req, res) => {
  res.json(await readProgress());
});

// Body: { id, status: "solved" | "attempted", code }
app.post('/api/progress', async (req, res) => {
  const { id, status, code } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const progress = await readProgress();
  const prev = progress[id] ?? {};
  progress[id] = {
    ...prev,
    // Once solved, stay solved.
    status: prev.status === 'solved' ? 'solved' : status ?? prev.status,
    code: code ?? prev.code,
    solvedAt: status === 'solved' ? prev.solvedAt ?? new Date().toISOString() : prev.solvedAt,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  res.json(progress[id]);
});

app.delete('/api/progress/:id', async (req, res) => {
  const progress = await readProgress();
  delete progress[req.params.id];
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`sql-leetcode api  →  http://localhost:${PORT}`);
});
