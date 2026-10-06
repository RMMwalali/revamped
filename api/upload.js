// POST /api/upload
//  - Admin (sc_admin cookie): media field "image"; images up to IMAGE_MAX,
//    video/audio up to 250MB when the platform allows it. Images are
//    normalized to WebP with sharp. NOTE: Vercel rejects request bodies over
//    ~4.5MB before this function runs, so the admin editor shrinks large photos
//    in the browser first (see dist/editbar.js).
//  - Public (no cookie): the quote form's attachments only - pdf/png/jpg/webp,
//    5MB, 20/hour per IP. Answers in the legacy {success,result.data.file_url}
//    shape the compiled quote form checks, alongside the new {ok,src,kind}.
// Storage: Cloudflare R2 when R2_* vars are set, else Vercel Blob (legacy)
// when BLOB_READ_WRITE_TOKEN is set, else local disk (dev only).
import crypto from 'node:crypto';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { parseUpload, sniffMedia, sniffImage, IMAGE_MAX } from '../scripts/transform.mjs';
import { isResizable } from '../scripts/imgpaths.mjs';
import { r2Configured, r2Head, r2Put, r2PublicUrl } from '../scripts/r2.mjs';

export const config = { api: { bodyParser: false } };

const LIMIT = 250 << 20; // 250MB stream cap (admin video)
const MAX_DIM = 1920;
const PUBLIC_MAX = 5 << 20; // 5MB
const PUBLIC_EXTS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);
const publicHits = new Map(); // ip -> {count, reset}

function publicAllowed(ip) {
  const now = Date.now();
  const e = publicHits.get(ip) || { count: 0, reset: now + 3600000 };
  if (now > e.reset) { e.count = 0; e.reset = now + 3600000; }
  e.count++;
  publicHits.set(ip, e);
  return e.count <= 20;
}

function compatOk(src, kind, extra = {}) {
  // New shape ({ok,src,kind}) + the legacy Zoho shape the compiled quote form
  // checks (e.success / e.result.data.file_url). Both clients work.
  return { ok: true, success: true, src, kind, ...extra, result: { success: true, data: { file_url: src } } };
}
function compatFail(msg, detail) {
  return { ok: false, success: false, error: msg, ...(detail ? { detail } : {}), result: { success: false, data: msg } };
}

class NotConfigured extends Error {}

function readBody(req, limit = LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function contentHash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

async function normalizeImage(input) {
  const { default: sharp } = await import('sharp');
  return sharp(input)
    .rotate() // honour the phone's EXIF orientation before it is stripped
    .resize(MAX_DIM, MAX_DIM, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
}

// Persist to whichever backend is configured. Returns { src, deduped }.
async function store(prefix, name, data, contentType) {
  const key = prefix + '/' + name;
  if (r2Configured()) {
    if (await r2Head(key).catch(() => false)) return { src: r2PublicUrl(key), deduped: true };
    await r2Put(key, data, contentType || 'application/octet-stream');
    return { src: r2PublicUrl(key), deduped: false };
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put, head } = await import('@vercel/blob');
    const existing = await head(key).catch(() => null);
    if (existing) return { src: existing.url, deduped: true };
    const blob = await put(key, data, {
      access: 'public', contentType: contentType || undefined,
      addRandomSuffix: false, allowOverwrite: true,
    });
    return { src: blob.url, deduped: false };
  }
  if (process.env.VERCEL) {
    throw new NotConfigured('uploads not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL - or BLOB_READ_WRITE_TOKEN for legacy Vercel Blob)');
  }
  const dir = path.join(process.cwd(), 'dist', 'assets', 'custom');
  await mkdir(dir, { recursive: true });
  const localPath = path.join(dir, name);
  try { await stat(localPath); return { src: '/assets/custom/' + name, deduped: true }; } catch {}
  await writeFile(localPath, data);
  return { src: '/assets/custom/' + name, deduped: false };
}

function stamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function failFromError(res, e) {
  console.error('[upload] error:', e?.message || e);
  const code = e instanceof NotConfigured ? 503 : 500;
  res.status(code).json(compatFail(e instanceof NotConfigured ? String(e.message) : 'upload failed', e instanceof NotConfigured ? undefined : String(e?.message || e).slice(0, 200)));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json(compatFail('method not allowed')); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  let buf;
  try { buf = await readBody(req); }
  catch { res.status(413).json(compatFail('file too large (max 250MB)')); return; }
  const part = parseUpload(buf, req.headers['content-type']);
  if (!part || !part.data.length) { res.status(400).json(compatFail('bad upload')); return; }
  const ext = sniffMedia(part.data, part.filename);
  if (!ext) { res.status(400).json(compatFail('unsupported media type (images, svg, video, audio, fonts)')); return; }

  if (!s) {
    // Public path (quote form): tight allowlist, clear errors.
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim().slice(0, 64);
    if (!publicAllowed(ip)) { res.status(429).json(compatFail('too many uploads, try later')); return; }
    const norm = ext === 'jpeg' ? 'jpg' : ext;
    if (!PUBLIC_EXTS.has(norm)) { res.status(403).json(compatFail('unsupported file type for public upload (pdf/png/jpg/webp only)')); return; }
    if (part.data.length > PUBLIC_MAX) { res.status(413).json(compatFail('file too large (max 5MB for public uploads)')); return; }
    if (norm !== 'pdf' && !sniffImage(part.data, norm)) { res.status(400).json(compatFail('invalid image format')); return; }
    try {
      const name = stamp() + '-' + contentHash(part.data) + '.' + norm;
      const out = await store('quote-uploads', name, part.data, part.type || undefined);
      res.status(200).json(compatOk(out.src, 'image'));
    } catch (e) { failFromError(res, e); }
    return;
  }

  // Admin path. Images must be a common web format and within IMAGE_MAX.
  const isImage = /^(png|jpg|jpeg|webp|gif|svg|avif|bmp|ico)$/.test(ext);
  if (isImage) {
    if (part.data.length > IMAGE_MAX) { res.status(413).json(compatFail('image too large (max 8MB)')); return; }
    if (!sniffImage(part.data, ext)) { res.status(400).json(compatFail('invalid image format')); return; }
  }
  const isBig = /^(mp4|m4v|mov|webm|mp3|wav|ogg|m4a)$/.test(ext);
  let finalData = part.data;
  let finalExt = ext;
  let finalType = part.type || 'application/octet-stream';
  if (isImage && isResizable('i.' + ext)) {
    try {
      finalData = await normalizeImage(part.data);
      finalExt = 'webp';
      finalType = 'image/webp';
    } catch (e) {
      // sharp unavailable or the file is not decodable: keep the original
      // rather than crash the request, but refuse if it is too big to be worth it.
      console.error('[upload] normalize failed, keeping original:', e?.message || e);
      finalData = part.data;
    }
  }
  try {
    const name = stamp() + '-' + contentHash(finalData) + '.' + finalExt;
    const out = await store('custom', name, finalData, finalType);
    res.status(200).json(compatOk(out.src, isBig ? 'media' : 'image', out.deduped ? { deduped: true } : {}));
  } catch (e) { failFromError(res, e); }
}
