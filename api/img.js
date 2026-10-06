// /_next/image shim with real resizing: serves the requested width/quality
// instead of redirecting every variant (blur placeholder included) to the
// full-size original. Same pixels, correct sizes - purely fewer bytes.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
// Small in-memory cache (per-instance). Entries are tiny (resized variants).
const CACHE = new Map();
const CACHE_MAX = 40;

function resolveTarget(src) {
  let target = src;
  try { target = decodeURIComponent(src); } catch {}
  if (target.startsWith('https://cms.iventions.com/')) {
    target = '/assets/cms/' + target.replace('https://cms.iventions.com/', '');
  } else if (!target.startsWith('/')) {
    target = '/' + target;
  }
  const p = path.normalize(path.join(ROOT, target));
  if (!p.startsWith(ROOT)) return null;
  return p;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const u = new URL(req.url, `${proto}://${req.headers.host || 'local'}`);
  const src = u.searchParams.get('url');
  if (!src) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(204).end();
    return;
  }
  const rawW = Math.min(3840, Math.max(0, parseInt(u.searchParams.get('w') || '0', 10) || 0));
  // Snap to a small whitelist so variants share cache keys instead of
  // creating a new sharp resize per arbitrary width (cache thrash -> CPU stall).
  const ALLOWED_W = [640, 750, 828, 1080, 1200, 1920, 3840];
  const w = rawW ? ALLOWED_W.find((a) => a >= rawW) || 3840 : 0;
  const q = Math.min(100, Math.max(10, parseInt(u.searchParams.get('q') || '75', 10) || 75));
  const file = resolveTarget(src);
  if (!file) { res.status(400).end(); return; }
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('missing');
    const ext = path.extname(file).toLowerCase();
    // Vector originals and unrequested sizes pass through untouched.
    if (ext === '.svg' || ext === '.ico' || !w) {
      res.writeHead(302, { Location: src.startsWith('/') ? src : '/' + src });
      res.end();
      return;
    }
    if (!MIME[ext]) {
      res.writeHead(302, { Location: src.startsWith('/') ? src : '/' + src });
      res.end();
      return;
    }
    const key = file + '|' + w + '|' + q;
    let buf = CACHE.get(key);
    if (!buf) {
      const { default: sharp } = await import('sharp');
      const input = await readFile(file);
      const meta = await sharp(input).metadata();
      if (meta.width && meta.width <= w) {
        // Never upscale: serve the original bytes.
        res.writeHead(302, { Location: src.startsWith('/') ? src : '/' + src });
        res.end();
        return;
      }
      let pipe = sharp(input).resize({ width: w, withoutEnlargement: true });
      if (ext === '.jpg' || ext === '.jpeg') pipe = pipe.jpeg({ quality: q, mozjpeg: true });
      else if (ext === '.png') pipe = pipe.png({ quality: q });
      else if (ext === '.webp') pipe = pipe.webp({ quality: q });
      else if (ext === '.gif') pipe = pipe.gif();
      else if (ext === '.avif') pipe = pipe.avif({ quality: q });
      buf = await pipe.toBuffer();
      if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
      CACHE.set(key, buf);
    } else {
      // LRU refresh.
      CACHE.delete(key);
      CACHE.set(key, buf);
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext],
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
  } catch {
    // Missing file: 404, not a redirect back at the same missing URL
    // (that caused a 404 loop: optimizer -> static -> 404 -> retry).
    res.status(404).end();
  }
}
