// Simple JSON key-value store backed by Cloudflare R2 (when R2_* vars are
// set), else Vercel Blob (legacy, when BLOB_READ_WRITE_TOKEN is set), else
// local filesystem (dev). Each "table" is a single JSON file so reads/writes
// are atomic at the file level. Good for low-write admin tools — not for
// high-concurrency user-facing data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { r2Configured, r2Get, r2Put } from './r2.mjs';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const IS_R2 = r2Configured();
const IS_BLOB = !IS_R2 && !!BLOB_TOKEN;
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), 'dist', '.data');

export async function readStore(name) {
  if (IS_R2) {
    const raw = await r2Get('sc-data/' + name);
    return raw == null ? null : JSON.parse(raw);
  }
  if (IS_BLOB) {
    // @vercel/blob has no `get()` export (head/list/put/del only) — importing
    // it threw "does not provide an export named 'get'", which broke EVERY
    // save (brand/overrides/cms all read the store before writing). Resolve the
    // download URL with head(), then fetch the body ourselves.
    const { head, BlobNotFoundError } = await import('@vercel/blob');
    let url;
    try {
      const meta = await head(name);
      url = meta.downloadUrl || meta.url;
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
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
    await put(name, json, { access: 'public', cacheControl: 'no-cache', allowOverwrite: true });
  } else {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(path.join(DATA_DIR, name), json, 'utf8');
  }
  return data;
}
