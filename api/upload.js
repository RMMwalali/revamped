// POST /api/upload (admin): media field "image", up to 8MB for images,
// 250MB for video/audio. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is
// set, else local disk (dev).
import crypto from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { parseUpload, sniffMedia, sniffImage, IMAGE_MAX } from '../scripts/transform.mjs';

export const config = { api: { bodyParser: false } };

const LIMIT = 250 << 20; // 250MB stream cap (admin video)
// Public quote-form attachments: small, safe types only. The compiled
// quote form posts /api/upload anonymously (no sc_admin cookie), so a
// blanket 401 breaks every file-attached quote. Admins keep the full
// 250MB media path below; the public path stays tight for VPS disk use.
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

function compatOk(src, kind) {
  // New shape ({ok,src,kind}) + legacy Zoho shape the compiled quote form
  // checks (e.success / e.result.data.file_url). Both legs, both clients.
  return { ok: true, success: true, src, kind, result: { success: true, data: { file_url: src } } };
}
function compatFail(msg) {
  return { ok: false, success: false, error: msg, result: { success: false, data: msg } };
}

async function storeFile(data, ext) {
  const name = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
    crypto.randomBytes(4).toString('hex') + '.' + ext;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put('custom/' + name, data, { access: 'public' });
    return blob.url;
  }
  if (process.env.VERCEL) return null; // misconfigured: no Blob on serverless
  const dir = path.join(process.cwd(), 'dist', 'assets', 'custom');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), data);
  return '/assets/custom/' + name;
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
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
    if (!sniffImage(part.data, norm) && norm !== 'pdf') {
      // pdf passes sniffMedia magic check above; images re-validated.
      if (norm !== 'pdf') { res.status(400).json(compatFail('invalid image format')); return; }
    }
    const src = await storeFile(part.data, norm);
    if (!src) { res.status(500).json(compatFail('uploads not configured (missing BLOB_READ_WRITE_TOKEN)')); return; }
    res.status(200).json(compatOk(src, 'image'));
    return;
  }
  // Images must be a common web format and ≤ 8MB.
  const isImage = /^(png|jpg|jpeg|webp|gif|svg|avif|bmp|ico)$/.test(ext);
  if (isImage) {
    if (part.data.length > IMAGE_MAX) { res.status(413).json(compatFail('image too large (max 8MB)')); return; }
    if (!sniffImage(part.data, ext)) { res.status(400).json(compatFail('invalid image format')); return; }
  }
  const isBig = /^(mp4|m4v|mov|webm|mp3|wav|ogg|m4a)$/.test(ext);
  const src = await storeFile(part.data, ext);
  if (!src) {
    res.status(500).json(compatFail('uploads not configured (missing BLOB_READ_WRITE_TOKEN)'));
    return;
  }
  res.status(200).json(compatOk(src, isBig ? 'media' : 'image'));
}
