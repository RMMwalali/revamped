// /_next/image shim with real resizing: serves the requested width/quality
// instead of redirecting every variant (blur placeholder included) to the
// full-size original. Same pixels, correct sizes - purely fewer bytes.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { snapWidth, extOf } from '../scripts/imgpaths.mjs';

const ROOT = path.join(process.cwd(), 'dist');
// Small in-memory cache (per-instance). Entries are tiny (resized variants).
const CACHE = new Map();
const CACHE_MAX = 64;
const RESIZABLE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp']);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp' };

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const u = new URL(req.url, `${proto}://${req.headers.host || 'local'}`);
  const src = u.searchParams.get('url');
  if (!src) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(204).end();
    return;
  }
  // Resolve the `url=` parameter to a local file. Absolute remote URLs
  // (Vercel Blob upload links saved in the DB) are redirected untouched: the
  // file lives outside dist and the browser can fetch it directly. Local paths
  // are validated against ROOT so a `../../`-style src can't escape the bundle.
  let target = src;
  try { target = decodeURIComponent(src); } catch {}
  if (/^https?:\/\//i.test(target)) {
    if (target.startsWith('https://cms.iventions.com/')) {
      target = '/assets/cms/' + target.replace('https://cms.iventions.com/', '');
    } else {
      res.writeHead(302, { Location: target, 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
  } else if (!target.startsWith('/')) {
    target = '/' + target;
  }
  const file = path.normalize(path.join(ROOT, target));
  if (!file.startsWith(ROOT)) { res.status(400).end(); return; }
  const passthrough = () => { res.writeHead(302, { Location: src.startsWith('/') ? src : target }); res.end(); };

  const rawW = Math.min(3840, Math.max(0, parseInt(u.searchParams.get('w') || '0', 10) || 0));
  const w = rawW ? snapWidth(rawW) : 0;
  const q = Math.min(100, Math.max(10, parseInt(u.searchParams.get('q') || '75', 10) || 75));
  const acceptWebp = /\bimage\/webp\b/i.test(String(req.headers.accept || ''));
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('missing');
    const ext = path.extname(file).toLowerCase();
    // Vector originals and requests without a width pass through untouched.
    if (!w || ext === '.svg' || ext === '.ico' || !RESIZABLE_EXTS.has(ext.slice(1))) { passthrough(); return; }
    const key = file + '|' + w + '|' + q + '|' + (acceptWebp ? 'w' : 'o');
    let buf = CACHE.get(key);
    if (!buf) {
      const { default: sharp } = await import('sharp');
      const input = await readFile(file);
      const meta = await sharp(input).metadata();
      // Cap at the source width instead of falling through to the original:
      // a request wider than the source used to 302 to the untouched asset,
      // handing the browser the full multi-hundred-KB file for a slot that
      // never needed it. Re-encoding the source's own width costs less.
      const targetW = Math.min(w, meta.width || w);
      let pipe = sharp(input).resize({ width: targetW, withoutEnlargement: true, fastShrinkOnLoad: true });
      if (acceptWebp) pipe = pipe.webp({ quality: q, effort: 4, smartSubsample: true });
      else if (ext === '.jpg' || ext === '.jpeg') pipe = pipe.jpeg({ quality: q, mozjpeg: true });
      else if (ext === '.png') pipe = pipe.png({ quality: q });
      else if (ext === '.webp') pipe = pipe.webp({ quality: q });
      else if (ext === '.avif') pipe = pipe.avif({ quality: q });
      else if (ext === '.bmp') pipe = pipe.png({ quality: q });
      buf = await pipe.toBuffer();
      if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
      CACHE.set(key, buf);
    } else {
      CACHE.delete(key); CACHE.set(key, buf); // LRU refresh
    }
    const outType = acceptWebp ? 'image/webp' : (MIME[ext] || 'image/webp');
    res.writeHead(200, {
      'Content-Type': outType,
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Vary': 'Accept',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
  } catch {
    // Missing file: 404, not a redirect back at the same missing URL
    // (that caused a 404 loop: optimizer -> static -> 404 -> retry).
    res.status(404).end();
  }
}
