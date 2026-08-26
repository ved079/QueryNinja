import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_DIR = path.join(__dirname, '..', 'problems', 'python');

export async function loadPythonProblems() {
  let files;
  try {
    files = await fs.readdir(PYTHON_DIR);
  } catch {
    return [];
  }
  const jsons = files.filter((f) => f.endsWith('.json')).sort();
  const problems = await Promise.all(
    jsons.map(async (f) => {
      const raw = await fs.readFile(path.join(PYTHON_DIR, f), 'utf8');
      return JSON.parse(raw);
    })
  );
  // Accept freerun problems (type=freerun) OR function problems (functionName + array inputs)
  return problems.filter((p) =>
    p.type === 'freerun' || (p.functionName && Array.isArray(p.tests?.[0]?.input))
  );
}
