import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('scraped');
const OUT = path.resolve('dist');
const ORIGIN = 'https://iventions.com';

// Collect all asset URLs referenced in the processed HTML
const assetUrlRe = /(?:src|href|content)=["']([^"']*?\.(?:css|js|woff2?|svg|png|jpe?g|webp|ico|json|avif))["']/gi;
const cssUrlRe = /url\(\s*["']?([^"')]+?\.(?:svg|png|jpe?g|webp|woff2?|gif))["']?\s*\)/gi;

async function collectAssets() {
  const files = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push(full);
    }
  }
  await walk(SRC);
  const urls = new Set();
  for (const f of files) {
    let html = await readFile(f, 'utf8');
    // absolute CMS
    for (const m of html.matchAll(/https:\/\/cms\.iventions\.com\/wp-content\/[^"'\s)]+/g)) {
      const clean = normalizeAsset(m[0]);
      if (clean) urls.add(clean);
    }
    for (const m of html.matchAll(assetUrlRe)) {
      let u = m[1];
      if (u.startsWith('/')) u = ORIGIN + u;
      if (/^https?\:\/\//.test(u)) {
        const clean = normalizeAsset(u);
        if (clean) urls.add(clean);
      }
    }
    for (const m of html.matchAll(cssUrlRe)) {
      let u = m[1];
      if (u.startsWith('/')) u = ORIGIN + u;
      if (/^https?\:\/\//.test(u)) {
        const clean = normalizeAsset(u);
        if (clean) urls.add(clean);
      }
    }
  }
  return [...urls];
}

// Keep only the clean URL up to the file extension + optional query (no srcset garbage)
function normalizeAsset(u) {
  // Strip any &... or whitespace-separated srcset remnants after the ext
  const extRe = /\.(css|js|woff2?|svg|png|jpe?g|webp|ico|json|avif|gif)(\?[^)\s"']*)?/i;
  const m = extRe.exec(u);
  if (!m) return null;
  return u.slice(0, m.index + m[0].length);
}

async function download(url) {
  // Map to local path
  let local;
  try {
    const u = new URL(url);
    if (u.hostname === 'cms.iventions.com') {
      local = path.join(OUT, 'assets', 'cms', ...u.pathname.split('/').filter(Boolean));
    } else if (u.pathname.startsWith('/_next/static/')) {
      local = path.join(OUT, 'assets', 'root', u.pathname.replace(/^\/_next\//, '_next/'));
    } else {
      local = path.join(OUT, 'assets', 'root', u.pathname.slice(1));
    }
  } catch {
    return;
  }
  await mkdir(path.dirname(local), { recursive: true });
  try {
    // Skip only if existing file is a genuine image (not an HTML error page from hotlink block)
    const existing = await stat(local);
    if (existing.size > 0) {
      // Skips re-download; HTML placeholders will be detected in clean step
      return;
    }
  } catch {}

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://iventions.com/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    }
  });
  if (!res.ok) {
    console.log(`  [${res.status}] ${url}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  // If server returned an HTML page where we expect an image, log it clearly
  const isHtml = ct.includes('html') || buf.slice(0, 4).toString('latin1').startsWith('<!DO');
  await writeFile(local, buf);
  console.log(`  ${isHtml ? 'HTML?' : 'OK  '} ${path.relative(OUT, local)} (${buf.length}) ct=${ct}`);
}

const urls = await collectAssets();
console.log(`Found ${urls.length} unique asset URLs`);
let i = 0;
for (const u of urls) {
  i++;
  await download(u);
}

// Clean step: delete any "downloaded" files that are actually HTML error pages
// (CMS hotlink-block) so the next run re-fetches them with proper headers.
const htmlLike = /^(<!DOCTYPE|<html)/i;
let cleaned = 0;
async function cleanWalk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await cleanWalk(full);
    else {
      const ext = path.extname(e.name).toLowerCase();
      if (['.jpg','.jpeg','.png','.webp','.gif','.avif','.ico','.svg'].includes(ext)) {
        try {
          const fd = await import('node:fs/promises').then(m => m.open(full));
          const head = Buffer.alloc(16);
          await fd.read(head, 0, 16, 0);
          await fd.close();
          if (htmlLike.test(head.toString('latin1')) || head.toString('latin1').includes('<!DOCTYPE')) {
            await import('node:fs/promises').then(m => m.rm(full, { force: true }));
            cleaned++;
          }
        } catch {}
      }
    }
  }
}
await cleanWalk(path.join(OUT, 'assets'));
console.log(`Removed ${cleaned} HTML-placeholder assets (will re-fetch)`);
