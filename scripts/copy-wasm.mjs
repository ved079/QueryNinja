/**
 * Copy sql.js's WebAssembly binaries into web/public so Vite serves them.
 * Runs automatically after npm install; they are not committed to git.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'node_modules', 'sql.js', 'dist');
const to = path.join(root, 'web', 'public');

fs.mkdirSync(to, { recursive: true });

let copied = 0;
for (const file of ['sql-wasm.wasm', 'sql-wasm-browser.wasm']) {
  const src = path.join(from, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(to, file));
    copied++;
  }
}

if (!copied) {
  console.error('sql.js wasm not found — run npm install first.');
  process.exit(1);
}
console.log(`copied ${copied} wasm file(s) to web/public`);
