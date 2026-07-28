import fs from 'node:fs/promises';
import path from 'node:path';

const ANON = 'anonymous';

// There is no login — the "user" is just whatever name someone typed into
// the name button, sent as a query param on reads and a body field on
// writes. Anyone who knows a name can see/edit that name's data; this is
// deliberately basic, not auth.
export const userKey = (name) => (typeof name === 'string' && name.trim() ? name.trim() : ANON);

/**
 * File-backed store: one JSON file per kind ("progress"/"submissions"),
 * each holding every user's bucket. Used locally and on Fly.io, where
 * DATA_DIR points at a real (optionally persistent-volume-backed) directory.
 */
function createFileStore(dataDir) {
  const fileFor = (kind) => path.join(dataDir, `${kind}.json`);

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
  // instead of silently vanishing.
  const isLegacyFlat = (all) =>
    Object.values(all).some((v) => typeof v !== 'object' || v === null || 'status' in v);

  return {
    async readUserBucket(kind, name) {
      const all = await readJsonFile(fileFor(kind));
      if (isLegacyFlat(all)) return userKey(name) === ANON ? all : {};
      return all[userKey(name)] ?? {};
    },
    async writeUserBucket(kind, name, bucket) {
      const file = fileFor(kind);
      const all = await readJsonFile(file);
      // Migrating out of the legacy flat shape must preserve that data under
      // ANON, not discard it — even when the write triggering the migration
      // belongs to a different (named) user.
      const migrated = isLegacyFlat(all) ? { [ANON]: all } : all;
      migrated[userKey(name)] = bucket;
      await fs.writeFile(file, JSON.stringify(migrated, null, 2));
      return bucket;
    },
    async listUsernames() {
      const all = await readJsonFile(fileFor('progress'));
      if (isLegacyFlat(all)) return [];
      return Object.keys(all).filter((k) => k !== ANON);
    },
  };
}

/**
 * Redis-backed store (Upstash, over REST — no persistent connection, which
 * is what makes it safe to use from a serverless function). Used on Vercel.
 * Each user's bucket is its own key, so there's no whole-file read/write
 * race the way the file store has, and no migration needed — this backend
 * only exists once per-user data already does.
 */
function createRedisStore() {
  let clientPromise;
  const getClient = () => {
    clientPromise ??= import('@upstash/redis').then(({ Redis }) => {
      // Support both the plain Upstash env var names and the ones Vercel's
      // "Vercel KV" (Upstash-backed) integration used historically, since
      // either could be present depending on how the store was provisioned.
      const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
      return new Redis({ url, token });
    });
    return clientPromise;
  };
  const keyFor = (kind, name) => `sql-practice:${kind}:${userKey(name)}`;

  return {
    async readUserBucket(kind, name) {
      const redis = await getClient();
      return (await redis.get(keyFor(kind, name))) ?? {};
    },
    async writeUserBucket(kind, name, bucket) {
      const redis = await getClient();
      await redis.set(keyFor(kind, name), bucket);
      return bucket;
    },
    async listUsernames() {
      const redis = await getClient();
      const keys = await redis.keys('sql-practice:progress:*');
      return keys
        .map((k) => k.replace('sql-practice:progress:', ''))
        .filter((k) => k !== ANON);
    },
  };
}

export function hasRedisEnv() {
  return !!(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

/** Picks the backend automatically — nothing to configure beyond env vars. */
export function createStore(dataDir) {
  const base = hasRedisEnv() ? createRedisStore() : createFileStore(dataDir);
  return {
    ...base,
    // Case-insensitive: "Alex" and "alex" count as the same username, even
    // though the stored bucket key itself keeps whatever casing was typed
    // first. `excludeName` lets a user re-save their own current name
    // (including just changing its casing) without it looking "taken".
    async isUsernameTaken(name, excludeName) {
      const target = userKey(name).toLowerCase();
      if (excludeName && target === userKey(excludeName).toLowerCase()) return false;
      const existing = await base.listUsernames();
      return existing.some((u) => u.toLowerCase() === target);
    },
  };
}
