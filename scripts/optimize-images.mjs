// Build-time image optimiser.
//
// Problem: the scraped markup ships srcsets whose every candidate points at the
// SAME full-size original ("X 1x, X 2x", or "X 640w..X 1920w"), so the browser
// downloads the original no matter how small the slot is - a 32x32 blur
// placeholder pulled a 541KB JPEG, a 66px header logo a 518KB PNG, and 64 eager
// images on the home page were all fetched that way.
//
// Fix: repoint every candidate at /_next/image with the width that slot
// actually needs. The optimizer (api/img.js / scripts/serve.mjs) resizes on the
// edge and sets `immutable`, so each variant is built once then served from the
// CDN cache. No derivative files are written to disk, so the deployment does
// not grow and the 245MB assets folder is no longer bundled into the page
// function - the build just rewrites existing references, which is why this is
// wired into npm run build.
//
// Encoding: local paths keep their '/' characters (they are url-safe and every
// downstream serve-time URL-rewrite pass - applyListingStaticFix, applyOverrides
// etc. - matches the decoded /assets/... substring, which is how stale template
// project imagery gets remapped to mall covers). Only absolute remote URLs are
// percent-encoded.
//
// Invariants so the UI cannot move:
//   - width/height attributes, class, style, loading and layout are never
//     changed except to fill in a *missing* width/height with the source's
//     intrinsic size - exactly what applyImgDims() did at serve time. The
//     aspect box - and therefore CLS - is unchanged.
//   - existing w-descriptors and sizes are preserved verbatim; only the URL
//     behind each candidate changes. Where a template used 1x/2x we keep 1x/2x
//     and set 1x to the measured slot width, 2x to twice that.
//   - a candidate never advertises more width than the source, so the browser
//     cannot select something smaller than it asked for.
//   - only <img>/<link> attributes are rewritten. The RSC flight payload stores
//     `sourceUrl` and no srcSet, and it is left untouched.
//   - svg, ico and gif are never rewritten.
//
// Usage: node scripts/optimize-images.mjs [--measure measure.json]
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { snapWidth, extOf, isResizable } from './imgpaths.mjs';

const DIST = path.resolve('dist');
const args = process.argv.slice(2);
const mArg = args.indexOf('--measure');
const MEASURE = mArg >= 0 && args[mArg + 1] ? args[mArg + 1] : null;
const Q = 72;

function encUrl(base) {
  if (base.startsWith('https://')) return encodeURIComponent(base);
  return base.replace(/[^A-Za-z0-9._~/-]/g, (c) => encodeURIComponent(c));
}
function optUrl(base, w) {
  return '/_next/image?url=' + encUrl(base) + '&w=' + w + '&q=' + Q;
}

// ---------- optional Playwright measurements ----------
let measured = null;
if (MEASURE) { try { measured = JSON.parse(await readFile(MEASURE, 'utf8')); } catch { measured = null; } }
const VPS = { desktop: 1440, tablet: 900, mobile: 390 };
function hintsFor(htmlFile) {
  const out = new Map();
  if (!measured) return out;
  const route = ('/' + path.relative(DIST, htmlFile).replace(/\\/g, '/').replace(/index\.html$/, '')).replace(/\/$/, '') || '/';
  const byVp = measured[route];
  if (!byVp) return out;
  for (const vp of Object.keys(byVp)) {
    const list = byVp[vp];
    if (!Array.isArray(list)) continue;
    const vw = VPS[vp] || 1440;
    for (const im of list) {
      if (!im || !im.src || !im.cssW) continue;
      let src = im.src;
      const m = /^\/_next\/image\?url=([^&]+)/.exec(src);
      if (m) { try { src = decodeURIComponent(m[1]); } catch {} }
      if (!src.startsWith('/assets/')) continue;
      const cur = out.get(src) || { maxW: 0 };
      cur.maxW = Math.max(cur.maxW, im.cssW);
      out.set(src, cur);
    }
  }
  return out;
}

// Slot width in CSS px. A small width attribute is authoritative (LQIP
// placeholders are exactly that) and needs no guessing.
function displayWidth(tag, base, hints) {
  const wAttr = parseInt(/\bwidth="(\d+)"/.exec(tag)?.[1] || '0', 10);
  if (wAttr > 0 && wAttr <= 160) return wAttr;
  const h = hints.get(base);
  if (h && h.maxW > 0) return Math.ceil(h.maxW);
  return 1920;
}

// ---------- collect ----------
async function htmlFiles(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await htmlFiles(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}
const files = await htmlFiles(DIST);
const RAW_IMG = /<img\b[^>]*>/gi;
const RAW_LINK = /<link\b[^>]*>/gi;
const URL_ATTR = /((?:src|srcset|imagesrcset|href))="([^"]*)"/gi;
const metaCache = new Map();
const existsCache = new Map();
async function metaOf(abs) {
  if (metaCache.has(abs)) return metaCache.get(abs);
  let m = null;
  try { m = await sharp(abs).metadata(); } catch {}
  metaCache.set(abs, m);
  return m;
}
async function exists(abs) {
  if (existsCache.has(abs)) return existsCache.get(abs);
  let ok = false;
  try { ok = (await stat(abs)).isFile(); } catch {}
  existsCache.set(abs, ok);
  return ok;
}

const plans = [];
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const hints = hintsFor(f);
  for (const m of html.matchAll(RAW_IMG)) plans.push({ file: f, tag: m[0], hints, preload: false });
  for (const m of html.matchAll(RAW_LINK)) {
    if (/rel="preload"/.test(m[0]) && /as="image"/.test(m[0])) plans.push({ file: f, tag: m[0], hints, preload: true });
  }
}

// ---------- rewrite ----------
function widthFor(entry, tag, base, hints) {
  const desc = (entry.split(/\s+/)[1] || '').trim();
  if (/^\d+w$/.test(desc)) return parseInt(desc, 10);
  const dw = displayWidth(tag, base, hints);
  return desc === '2x' ? dw * 2 : dw;
}

let cands = 0, tags = 0, dimsAdded = 0;

async function rewriteTag(tag, hints) {
  const attrs = [...tag.matchAll(URL_ATTR)];
  const pieces = [];
  let cursor = 0, changed = false;

  for (const m of attrs) {
    const [full, attr, val] = m;
    if (!val.includes('/assets/')) continue;
    const isSet = /set$/i.test(attr);
    const entries = isSet ? val.split(',').map((s) => s.trim()).filter(Boolean) : [val];
    const plan = [];
    for (const entry of entries) {
      const url = (entry.split(/\s+/)[0] || '');
      if (!url.startsWith('/') || !isResizable(url)) { plan.push(null); continue; }
      const base = url.split('?')[0];
      const abs = path.join(DIST, base);
      if (!(await exists(abs))) { plan.push(null); continue; }
      const meta = await metaOf(abs);
      const sw = meta && meta.width ? meta.width : 0;
      let w = snapWidth(widthFor(entry, tag, base, hints));
      if (sw && w > sw) w = sw;           // never upscale
      if (!w || !sw) { plan.push(null); continue; }
      plan.push({ base, w, sw, desc: (entry.split(/\s+/)[1] || '').trim() });
    }
    if (!plan.some(Boolean)) continue;

    let newVal;
    if (isSet) {
      newVal = entries.map((entry, i) => {
        const p = plan[i];
        if (!p) return entry;
        cands++;
        const u = optUrl(p.base, p.w);
        if (/^\d+w$/.test(p.desc)) return u + ' ' + p.w + 'w';
        return u + (p.desc ? ' ' + p.desc : '');
      }).join(', ');
    } else {
      const p = plan.find(Boolean);
      if (!p) continue;
      cands++;
      newVal = optUrl(p.base, p.w);
    }
    if (newVal === val) continue;
    pieces.push(tag.slice(cursor, m.index));
    pieces.push(attr + '="' + newVal + '"');
    cursor = m.index + full.length;
    changed = true;
  }

  if (!changed) return tag;
  pieces.push(tag.slice(cursor));
  tags++;
  return pieces.join('');
}

// Fill in a missing width/height with the source's intrinsic size, which is what
// applyImgDims() used to do at serve time. Doing it here lets api/page.js stop
// bundling every image just to read its size. Runs after the URL rewrite so it
// inspects the final src, and never overwrites an existing value.
async function ensureDims(tag) {
  if (/\bwidth="/.test(tag) || !/^<img\b/.test(tag)) return tag;
  let raw = (/\bsrc="([^"]+)"/.exec(tag)?.[1] || '').split('?')[0];
  let inner = raw;
  const m = /^\/_next\/image\?url=([^&]+)/.exec(raw);
  if (m) { try { inner = decodeURIComponent(m[1]); } catch {} }
  if (!inner.startsWith('/') || !isResizable(inner)) return tag;
  const abs = path.join(DIST, inner);
  if (!(await exists(abs))) return tag;
  const meta = await metaOf(abs);
  if (!meta || !meta.width || !meta.height) return tag;
  dimsAdded++;
  return tag.replace(/<img/i, `<img width="${Math.round(meta.width)}" height="${Math.round(meta.height)}"`);
}

const byFile = new Map();
for (const p of plans) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
let changedFiles = 0;
for (const [f, list] of byFile) {
  const original = await readFile(f, 'utf8');
  let out = original;
  for (const p of list) {
    const next = await ensureDims(await rewriteTag(p.tag, p.hints));
    if (next !== p.tag) out = out.split(p.tag).join(next);
  }
  if (out !== original) { await writeFile(f, out); changedFiles++; }
}
console.log(`[opt] ${files.length} html files`);
console.log(`[opt] repointed ${cands} candidates in ${tags} tags across ${changedFiles} files`);
console.log(`[opt] baked intrinsic width/height on ${dimsAdded} images`);
