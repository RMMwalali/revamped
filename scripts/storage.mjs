// Simple JSON key-value store backed by Cloudflare R2 (when R2_* vars are
// set), else Vercel Blob (legacy, when BLOB_READ_WRITE_TOKEN is set), else
// local filesystem (dev). Each "table" is a single JSON file so reads/writes
// are atomic at the file level. Good for low-write admin tools — not for
// high-concurrency user-facing data.
import './env.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { r2Configured, r2Get, r2Put } from './r2.mjs';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const IS_R2 = r2Configured();
const IS_BLOB = !IS_R2 && !!BLOB_TOKEN;
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), 'dist', '.data');

// On Vercel the filesystem fallback is /tmp, which is per-instance and wiped
// between invocations: an admin edit would appear to save and then vanish.
// R2 or Blob is the only durable option there.
if (process.env.VERCEL && !IS_R2 && !IS_BLOB) {
  console.warn('[storage] neither R2_* nor BLOB_READ_WRITE_TOKEN is set: saves go to /tmp and will not survive. Configure R2 (or Blob) in the Vercel dashboard.');
}

export async function readStore(name) {
  if (IS_R2) {
    const raw = await r2Get('sc-data/' + name);
    return raw == null ? null : JSON.parse(raw);
  }
  if (IS_BLOB) {
    // @vercel/blob exposes head/list/put/del - there is no `get`. Resolve the
    // pathname to its URL, then fetch it. Only "does not exist" maps to null:
    // any other failure must throw, otherwise a transient error reads as an
    // empty store and the next save overwrites everything that was there.
    const { head, BlobNotFoundError } = await import('@vercel/blob');
    let url;
    try {
      const meta = await head(name, { token: BLOB_TOKEN });
      url = meta.downloadUrl || meta.url;
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
    if (!url) return null;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('blob read ' + name + ': ' + res.status);
    return JSON.parse(await res.text());
  }
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, name), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeStore(name, data) {
  const json = JSON.stringify(data, null, 2);
  if (IS_R2) {
    await r2Put('sc-data/' + name, Buffer.from(json, 'utf8'), 'application/json');
    return data;
  }
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
