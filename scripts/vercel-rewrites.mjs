// Regenerate vercel.json rewrites so EVERY public HTML page is served through
// /api/page (brand + content overrides + mini-CMS + hero video from Postgres).
// Without this, Vercel serves dist/*.html statically and DB edits only ever
// show for the admin (via the edit bar's client-side patch).
// Usage: node scripts/vercel-rewrites.mjs
// Re-run whenever prerendered routes are added/removed.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('dist');
const VERCEL_JSON = path.resolve('vercel.json');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'insider' || e.name === 'vendor') continue; // dashboard + vendor stay static
      out.push(...await walk(full));
    } else if (e.name.endsWith('.html') && !e.name.startsWith('_')) {
      out.push(full);
    }
  }
  return out;
}

const routes = new Set(['/']);
for (const f of await walk(ROOT)) {
  let rel = path.relative(ROOT, f).split(path.sep).join('/');
  rel = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  routes.add('/' + rel.replace(/^\//, ''));
}
// Drop stray "index" route (dist/index.html -> "/"), keep /home page as-is.
routes.delete('/index');

const sorted = [...routes].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
const rewrites = [{ source: '/_next/image', destination: '/api/img' }];
for (const r of sorted) {
  rewrites.push({ source: r, destination: `/api/page?path=${r}` });
  // Trailing-slash parity: vercel.json source "/about" does not match
  // "/about/" (cleanUrls/trailingSlash false), but pageKey() normalizes.
  if (r !== '/') rewrites.push({ source: r + '/', destination: `/api/page?path=${r}` });
}
// Aliases with no static file (handled in api/page.js + serve.mjs).
for (const a of ['/projects/mall-activations', '/projects/mall-activations/']) {
  rewrites.push({ source: a, destination: '/api/page?path=/projects' });
}

const raw = await readFile(VERCEL_JSON, 'utf8');
const cfg = JSON.parse(raw);
cfg.rewrites = rewrites;
await writeFile(VERCEL_JSON, JSON.stringify(cfg, null, 2) + '\n');
console.log(`vercel.json rewrites: ${rewrites.length} (${sorted.length} pages + image shim)`);
