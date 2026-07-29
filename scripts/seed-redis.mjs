import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..');

// Load .env if present
if (existsSync(path.join(DATA_DIR, '.env'))) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(DATA_DIR, '.env') });
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('Missing Upstash Redis credentials.');
  console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN).');
  process.exit(1);
}

const redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });

function readJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!existsSync(filepath)) return {};
  return JSON.parse(readFileSync(filepath, 'utf8'));
}

const progress = readJson('progress.json');
const submissions = readJson('submissions.json');
const byName = readJson('users-by-name.json');
const byEmail = readJson('users-by-email.json');

const users = new Set([...Object.keys(progress), ...Object.keys(submissions), ...Object.keys(byName)]);

console.log(`Found ${users.size} user(s): ${[...users].join(', ')}`);
console.log('---');

let count = 0;
for (const username of users) {
  const key = username === 'anonymous' ? 'anonymous' : username;

  const userProgress = progress[key];
  if (userProgress && Object.keys(userProgress).length > 0) {
    await redis.set(`sql-practice:progress:${key}`, userProgress);
    console.log(`  ✓ progress:${key} (${Object.keys(userProgress).length} entries)`);
    count++;
  }

  const userSubmissions = submissions[key];
  if (userSubmissions && userSubmissions.length > 0) {
    await redis.set(`sql-practice:submissions:${key}`, userSubmissions);
    console.log(`  ✓ submissions:${key} (${userSubmissions.length} entries)`);
    count++;
  }

  const email = byName[key];
  if (email) {
    await redis.set(`sql-practice:user-to-email:${key}`, email);
    await redis.set(`sql-practice:email-to-user:${email}`, key);
    console.log(`  ✓ email mapping: ${key} <-> ${email}`);
    count += 2;
  }
}

console.log('---');
console.log(`Done. ${count} Redis keys written.`);
