// Simple JSON key-value store backed by Vercel Blob (production) or local
// filesystem (dev). Each "table" is a single JSON file so reads/writes are
// atomic at the file level. Good for low-write admin tools — not for
// high-concurrency user-facing data.
import './env.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const IS_BLOB = !!BLOB_TOKEN;
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), 'dist', '.data');

// On Vercel the filesystem fallback is /tmp, which is per-instance and wiped
// between invocations: an admin edit would appear to save and then vanish.
// Blob is the only durable option there.
if (process.env.VERCEL && !IS_BLOB) {
  console.warn('[storage] BLOB_READ_WRITE_TOKEN is not set: saves go to /tmp and will not survive. Add the token in the Vercel dashboard.');
}

export async function readStore(name) {
  if (IS_BLOB) {
    // @vercel/blob exposes head/list/put/del — there is no `get`. Resolve the
    // pathname to its public URL, then fetch it. head() throws when the blob
    // does not exist yet, which is the normal empty-store case.
    const { head } = await import('@vercel/blob');
    let meta;
    try {
      meta = await head(name, { token: BLOB_TOKEN });
    } catch {
      return null;
    }
    if (!meta || !meta.url) return null;
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return null;
    try {
      return JSON.parse(await res.text());
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, name), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeStore(name, data) {
  const json = JSON.stringify(data, null, 2);
  if (IS_BLOB) {
    const { put } = await import('@vercel/blob');
    await put(name, json, {
      access: 'public',
      token: BLOB_TOKEN,
      contentType: 'application/json',
      // Keep the pathname stable so head(name) can find it again, and allow
      // the overwrite: without these the first save works and every later one
      // fails with "blob already exists" at a new random pathname.
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControl: 'no-cache, max-age=0',
    });
  } else {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(path.join(DATA_DIR, name), json, 'utf8');
  }
  return data;
}
