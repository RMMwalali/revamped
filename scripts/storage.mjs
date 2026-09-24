// Simple JSON key-value store backed by Vercel Blob (production) or local
// filesystem (dev). Each "table" is a single JSON file so reads/writes are
// atomic at the file level. Good for low-write admin tools — not for
// high-concurrency user-facing data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const IS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
// Vercel serverless functions have a read-only filesystem except /tmp.
// Use /tmp locally on Vercel so writes don't crash in a pinch;
// Blob storage is the real production path when the token is set.
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), 'dist', '.data');

export async function readStore(name) {
  if (IS_BLOB) {
    const { get } = await import('@vercel/blob');
    const blob = await get(name);
    if (!blob) return null;
    return JSON.parse(await blob.text());
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
    await put(name, json, { access: 'public', cacheControl: 'no-cache' });
  } else {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(path.join(DATA_DIR, name), json, 'utf8');
  }
  return data;
}
