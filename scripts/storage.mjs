// JSON key-value store for admin-editable content (cms.json, overrides.json,
// brand.json, leads.json). Backends, in order of preference:
//   1. Cloudflare R2      (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)
//   2. Vercel Blob        (BLOB_READ_WRITE_TOKEN; added automatically when a
//                          Blob store is connected to the project in Vercel)
//   3. Local disk         (dev only: dist/.data/)
// R2 and Blob live outside the deployment, so saved content survives every
// redeploy. The same credentials in a local .env make localhost read and
// write the live content too.
//
// Why saves are versioned
// -----------------------
// Every save is a read-modify-write of one JSON file (e.g. all CMS sections
// live in cms.json). Vercel Blob serves files through a CDN, and an
// overwritten file can keep being served from cache for a while. A save that
// read a cached copy wrote the OLD content back with one field changed, which
// silently undid the previous save. Now:
//   - every save also writes an immutable copy at sc-versions/<name>/<time>.json
//     (a URL that is never overwritten, so it can never be served stale);
//   - saves (updateStore) and admin views read the newest immutable copy, the
//     authoritative value, never the cached current file;
//   - public page views read the current file with a cache-busting query, so
//     visitors see a save within seconds.
// The versions double as an edit history (the newest 50 are kept on Blob).
//
// On Vercel with no R2/Blob configured, writes FAIL with StorageNotConfigured
// instead of "succeeding" into /tmp, which is wiped between requests.
import './env.mjs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { r2Configured, r2Get, r2Put, r2Settings } from './r2.mjs';

const BLOB_TOKEN = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
const IS_R2 = r2Configured();
const IS_BLOB = !IS_R2 && !!BLOB_TOKEN;
const ON_VERCEL = !!process.env.VERCEL;
const IS_LOCAL = !IS_R2 && !IS_BLOB && !ON_VERCEL;
const DATA_DIR = process.env.SC_DATA_DIR || path.join(process.cwd(), 'dist', '.data');
const KEEP_VERSIONS = 50;

export class StorageNotConfigured extends Error {
  constructor() {
    super('Saving is not set up on this server, so nothing can be stored permanently. ' +
      'In Vercel → Settings → Environment Variables add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL for Production and Preview, then redeploy.');
    this.code = 'STORAGE_NOT_CONFIGURED';
  }
}

if (ON_VERCEL && !IS_R2 && !IS_BLOB) {
  console.error('[storage] no R2_* (or BLOB_READ_WRITE_TOKEN): admin saves will be refused. Set the R2_* variables in Vercel.');
}

export function storageInfo() {
  const backend = IS_R2 ? 'r2' : IS_BLOB ? 'blob' : IS_LOCAL ? 'local' : 'none';
  const r2 = r2Settings();
  const warnings = [];
  if (!IS_R2 && r2.anySet) {
    warnings.push('R2 is only partly set up (missing: ' + r2.missing.join(', ') + '), so it is NOT being used' +
      (IS_BLOB ? '; saves are going to Vercel Blob instead.' : '.'));
  }
  if (IS_R2 && !r2.publicUrlSet) warnings.push('R2_PUBLIC_URL is not set: text saves work, but image and video uploads will fail.');
  if (IS_R2 && BLOB_TOKEN) warnings.push('BLOB_READ_WRITE_TOKEN is still set. It is no longer used for saving; keep it only until old content and images have been moved over.');
  return {
    backend,
    durable: IS_R2 || IS_BLOB,
    warnings,
    r2: { bucket: r2.bucket, endpoint: r2.endpoint, publicUrlSet: r2.publicUrlSet },
    label: {
      r2: 'Cloudflare R2 (permanent)',
      blob: 'Vercel Blob (permanent)',
      local: 'This computer only (dist/.data) - not on the live site',
      none: 'NOT CONNECTED - saves are refused',
    }[backend],
  };
}

// Reads inside withFreshReads() use the authoritative (uncached) path.
const fresh = new AsyncLocalStorage();
export function withFreshReads(fn) { return fresh.run(true, fn); }

function versionName() {
  return new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 8) + '.json';
}
const versionsPrefix = (name) => 'sc-versions/' + name + '/';

// ---------------------------------------------------------------- Vercel Blob
let blobMod;
async function blob() {
  if (!blobMod) blobMod = await import('@vercel/blob');
  return blobMod;
}
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error('blob read ' + res.status);
  return JSON.parse(await res.text());
}
async function blobCurrent(name) {
  const { head, BlobNotFoundError } = await blob();
  let meta;
  try { meta = await head(name, { token: BLOB_TOKEN }); }
  catch (e) { if (e instanceof BlobNotFoundError) return null; throw e; }
  const base = meta.url || meta.downloadUrl;
  if (!base) return null;
  // head() comes from the API (fresh); the query makes the CDN treat each
  // saved revision as a new object instead of replaying a cached one.
  const v = new Date(meta.uploadedAt || Date.now()).getTime();
  const data = await fetchJson(base + (base.includes('?') ? '&' : '?') + 'v=' + v);
  return data === undefined ? null : data;
}
async function blobVersions(name) {
  const { list } = await blob();
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: versionsPrefix(name), limit: 1000, cursor, token: BLOB_TOKEN });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => (a.pathname < b.pathname ? -1 : a.pathname > b.pathname ? 1 : 0));
}
async function blobLatest(name) {
  const versions = await blobVersions(name);
  if (!versions.length) return blobCurrent(name); // nothing versioned yet: legacy file
  const data = await fetchJson(versions[versions.length - 1].url); // immutable URL
  return data === undefined ? null : data;
}
async function blobWrite(name, json) {
  const { put, del } = await blob();
  await put(versionsPrefix(name) + versionName(), json, {
    access: 'public', token: BLOB_TOKEN, contentType: 'application/json', addRandomSuffix: false,
  });
  await put(name, json, {
    access: 'public', token: BLOB_TOKEN, contentType: 'application/json',
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
  });
  // Trim history (best effort; a failure here never fails the save).
  try {
    const versions = await blobVersions(name);
    const old = versions.slice(0, Math.max(0, versions.length - KEEP_VERSIONS)).map((b) => b.url);
    if (old.length) await del(old, { token: BLOB_TOKEN });
  } catch (e) { console.warn('[storage] version trim failed:', e?.message || e); }
}

// ---------------------------------------------------------------------- local
async function localRead(name) {
  try { return JSON.parse(await readFile(path.join(DATA_DIR, name), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
async function localWrite(name, json) {
  const vdir = path.join(DATA_DIR, '_versions', name);
  await mkdir(vdir, { recursive: true });
  await writeFile(path.join(vdir, versionName()), json, 'utf8');
  await writeFile(path.join(DATA_DIR, name), json, 'utf8');
}

// ----------------------------------------------------------------------- API
// Returns the parsed JSON, or null when the store has never been written.
// Any other failure THROWS: treating an error as "empty" would let the next
// save overwrite everything that was there.
export async function readStore(name) {
  if (IS_R2) {
    const raw = await r2Get('sc-data/' + name); // S3 API: strongly consistent
    return raw == null ? null : JSON.parse(raw);
  }
  if (IS_BLOB) return fresh.getStore() ? blobLatest(name) : blobCurrent(name);
  if (IS_LOCAL) return localRead(name);
  return null; // Vercel without storage: nothing saved, site shows defaults
}

export async function readStoreFresh(name) {
  return withFreshReads(() => readStore(name));
}

export async function writeStore(name, data) {
  const json = JSON.stringify(data, null, 2);
  if (IS_R2) {
    const body = Buffer.from(json, 'utf8');
    await r2Put(versionsPrefix(name) + versionName(), body, 'application/json');
    await r2Put('sc-data/' + name, body, 'application/json');
  } else if (IS_BLOB) {
    await blobWrite(name, json);
  } else if (IS_LOCAL) {
    await localWrite(name, json);
  } else {
    throw new StorageNotConfigured();
  }
  return data;
}

// Read the authoritative current value, let `fn` change it, write it back.
// Saves within one server instance are serialised per store, so two quick
// saves cannot both start from the same old copy.
const queues = new Map();
// Return SKIP from `fn` to finish without writing (e.g. a rejected submission).
export const SKIP = Symbol('skip');
export function updateStore(name, fn) {
  if (!IS_R2 && !IS_BLOB && !IS_LOCAL) return Promise.reject(new StorageNotConfigured());
  const prev = queues.get(name) || Promise.resolve();
  const run = prev.catch(() => {}).then(async () => {
    const current = await readStoreFresh(name);
    const next = await fn(current);
    if (next === SKIP) return current;
    await writeStore(name, next);
    return next;
  });
  queues.set(name, run);
  run.finally(() => { if (queues.get(name) === run) queues.delete(name); }).catch(() => {});
  return run;
}

// Live check that this server can really write and read back. Shown in
// /insider so a wrong key, bucket or permission is visible before an edit
// is lost to it.
export async function probeStorage() {
  const started = Date.now();
  const stamp = new Date().toISOString() + ' ' + Math.random().toString(36).slice(2, 8);
  try {
    if (IS_R2) {
      await r2Put('sc-data/_health.json', Buffer.from(JSON.stringify({ stamp }), 'utf8'), 'application/json');
      const back = JSON.parse((await r2Get('sc-data/_health.json')) || '{}');
      if (back.stamp !== stamp) throw new Error('R2 accepted the write but returned different content on read.');
    } else if (IS_BLOB) {
      await blobCurrent('cms.json');
    } else if (IS_LOCAL) {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(path.join(DATA_DIR, '_health.json'), JSON.stringify({ stamp }), 'utf8');
    } else {
      throw new StorageNotConfigured();
    }
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 400) };
  }
}

// Old content still in Vercel Blob (used by the Blob -> R2 import). Works
// whenever BLOB_READ_WRITE_TOKEN is set, whichever backend is active.
export const hasLegacyBlob = () => !!BLOB_TOKEN;
export async function readLegacyBlob(name) {
  if (!BLOB_TOKEN) return null;
  return blobLatest(name);
}
export const activeBackend = () => (IS_R2 ? 'r2' : IS_BLOB ? 'blob' : IS_LOCAL ? 'local' : 'none');

// Newest-first list of saved versions (for diagnostics / future restore).
export async function listVersions(name) {
  if (IS_BLOB) return (await blobVersions(name)).reverse().map((b) => ({ id: b.pathname.split('/').pop(), at: b.uploadedAt }));
  if (IS_LOCAL) {
    try { return (await readdir(path.join(DATA_DIR, '_versions', name))).sort().reverse().map((id) => ({ id })); }
    catch { return []; }
  }
  return [];
}
