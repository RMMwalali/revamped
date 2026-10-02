// /_next/image shim with real resizing: serves the requested width/quality
// instead of redirecting every variant (blur placeholder included) to the
// full-size original. Same pixels, correct sizes - purely fewer bytes.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
// Small in-memory cache (per-instance). Entries are tiny (resized variants).
const CACHE = new Map();
const CACHE_MAX = 40;

// Returns { remote } for an absolute URL this shim cannot resize, { file, pub }
// for a path under dist (pub = the same asset as a browser-facing URL), or null
// for a path that escapes the root.
//
// Uploads are stored in Vercel Blob and saved as absolute URLs
// (https://<store>.public.blob.vercel-storage.com/custom/<name>), so once an
// admin swaps an image the flight payload carries a remote src and hydration
// rebuilds it as /_next/image?url=<absolute>. Treating that as a local path
// resolved it to dist/https:/<store>... , stat threw, and the catch-all
// 302'd to the same bogus path - every uploaded slot 404'd for anyone not
// running the edit bar, which re-asserts the raw src client-side and so
// masked it while logged in. Remote sources are redirected to untouched.
function resolveTarget(src) {
  let target = src;
  try { target = decodeURIComponent(src); } catch {}
  if (/^https?:\/\//i.test(target)) {
    if (target.startsWith('https://cms.iventions.com/')) {
      target = '/assets/cms/' + target.replace('https://cms.iventions.com/', '');
    } else {
      return { remote: target };
    }
  } else if (!target.startsWith('/')) {
    target = '/' + target;
  }
  const p = path.normalize(path.join(ROOT, target));
  if (!p.startsWith(ROOT)) return null;
  // pub is the resolved, browser-facing form. Passthrough redirects must use it
  // rather than the raw src: a mapped donor URL is relative on disk but
  // absolute as written, so reusing src rebuilt the very "/https://..." target
  // the guard above exists to prevent.
  return { file: p, pub: target };
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
  const target = resolveTarget(src);
  if (!target) { res.status(400).end(); return; }
  if (target.remote) {
    res.writeHead(302, { Location: target.remote, 'Access-Control-Allow-Origin': '*' });
    res.end();
    return;
  }
  const file = target.file;
  // Passthrough redirects keep the src verbatim when it is already rooted (its
  // encoding survives) and otherwise use the resolved path - see resolveTarget.
  const passthrough = () => { res.writeHead(302, { Location: src.startsWith('/') ? src : target.pub }); res.end(); };
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('missing');
    const ext = path.extname(file).toLowerCase();
    // Vector originals and unrequested sizes pass through untouched.
    if (ext === '.svg' || ext === '.ico' || !w) {
      passthrough();
      return;
    }
    if (!MIME[ext]) {
      passthrough();
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
        passthrough();
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
    passthrough();
  }
}
