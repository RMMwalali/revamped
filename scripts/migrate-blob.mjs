// Move from Vercel Blob to Cloudflare R2, safely.
//
// importBlobData(): copies cms.json, overrides.json, brand.json and
//   leads.json from Blob into R2 - only for the ones R2 does not have yet
//   (never overwrites anything already saved in R2).
// moveBlobFiles(): finds every Vercel Blob file address (uploaded images,
//   videos, logo) inside the saved content, copies each file into R2 at the
//   same path, and rewrites the content to the R2 address. Safe to run again:
//   already-moved files are skipped.
//
// Used by POST /api/storage (buttons in /insider) and runnable locally:
//   node scripts/migrate-blob.mjs            (both steps, needs .env with R2_* + BLOB_READ_WRITE_TOKEN)
import { readStoreFresh, updateStore, writeStore, readLegacyBlob, hasLegacyBlob, activeBackend, SKIP } from './storage.mjs';
import { r2Head, r2Put, r2PublicUrl, r2Settings } from './r2.mjs';

export const STORES = ['cms.json', 'overrides.json', 'brand.json', 'leads.json'];
const BLOB_URL = /https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>)\\]+/gi;

function needR2AndBlob() {
  if (activeBackend() !== 'r2') throw new Error('R2 is not the active storage on this server, so there is nothing to move into.');
  if (!hasLegacyBlob()) throw new Error('BLOB_READ_WRITE_TOKEN is not set, so the old Blob content cannot be read. Add it back temporarily to import.');
}

export async function importBlobData() {
  needR2AndBlob();
  const report = [];
  for (const name of STORES) {
    const existing = await readStoreFresh(name);
    if (existing != null) { report.push({ name, result: 'kept (R2 already has saved content)' }); continue; }
    const old = await readLegacyBlob(name);
    if (old == null) { report.push({ name, result: 'nothing in Blob' }); continue; }
    await writeStore(name, old);
    report.push({ name, result: 'imported from Blob' });
  }
  return report;
}

function blobUrlsIn(value) {
  return [...new Set((JSON.stringify(value || null).match(BLOB_URL) || []))];
}

export async function moveBlobFiles() {
  if (activeBackend() !== 'r2') throw new Error('R2 is not the active storage on this server.');
  if (!r2Settings().publicUrlSet) throw new Error('Set R2_PUBLIC_URL first: moved files need a public R2 address.');
  const urls = new Set();
  for (const name of STORES) for (const u of blobUrlsIn(await readStoreFresh(name))) urls.add(u);
  const moved = {}; const failed = [];
  for (const url of urls) {
    const key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
    try {
      if (!(await r2Head(key))) {
        const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error('download failed: ' + res.status);
        await r2Put(key, Buffer.from(await res.arrayBuffer()), res.headers.get('content-type') || 'application/octet-stream');
      }
      moved[url] = r2PublicUrl(key);
    } catch (e) {
      failed.push({ url, error: String(e?.message || e).slice(0, 200) });
    }
  }
  let rewritten = 0;
  if (Object.keys(moved).length) {
    for (const name of STORES) {
      await updateStore(name, (data) => {
        if (data == null) return SKIP;
        let json = JSON.stringify(data);
        const before = json;
        for (const [from, to] of Object.entries(moved)) json = json.split(from).join(to);
        if (json === before) return SKIP;
        rewritten++;
        return JSON.parse(json);
      });
    }
  }
  return { found: urls.size, moved: Object.keys(moved).length, failed, storesUpdated: rewritten };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log('import:', await importBlobData());
    console.log('files:', await moveBlobFiles());
  } catch (e) { console.error(e.message); process.exit(1); }
}

