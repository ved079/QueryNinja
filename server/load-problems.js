import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBLEMS_DIR = path.join(ROOT, 'problems');
const FAMILIES_DIR = path.join(PROBLEMS_DIR, 'families');
const SPECS_DIR = path.join(PROBLEMS_DIR, 'specs');

const readJsonDir = async (dir) => {
  let files;
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    try {
      out.push({ file, data: JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')) });
    } catch (err) {
      console.error(`Skipping malformed file ${file}: ${err.message}`);
    }
  }
  return out;
};

/**
 * Problems come from two places:
 *  - problems/*.json        one self-contained problem, carrying its own tests
 *  - problems/specs/*.json  arrays of problems that borrow their schema and
 *                           ten test datasets from a family in problems/families
 */
export async function loadProblems() {
  const families = Object.fromEntries(
    (await readJsonDir(FAMILIES_DIR)).map(({ data }) => [data.family, data])
  );

  const problems = (await readJsonDir(PROBLEMS_DIR)).map(({ data }) => data);

  for (const { file, data } of await readJsonDir(SPECS_DIR)) {
    for (const spec of data) {
      const family = families[spec.family];
      if (!family) {
        console.error(`${file}: problem "${spec.id}" wants unknown family "${spec.family}"`);
        continue;
      }
      problems.push({
        ...spec,
        schemaSql: spec.schemaSql ?? family.schemaSql,
        // Family datasets are the test cases; a spec may append its own.
        tests: [...family.variants, ...(spec.extraTests ?? [])],
      });
    }
  }

  problems.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  return problems;
}
