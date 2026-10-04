// POST /api/upload (admin): media field "image", up to 8MB for images,
// 250MB for video/audio. Storage: Cloudflare R2 when R2_* vars are set,
// else Vercel Blob (legacy) when BLOB_READ_WRITE_TOKEN is set, else local
// disk (dev). Deduplicates uploads via content hash, normalizes images to
// WebP with sharp to cut bytes.
import crypto from 'node:crypto';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { parseUpload, sniffMedia, sniffImage, IMAGE_MAX } from '../scripts/transform.mjs';
import { isResizable } from '../scripts/imgpaths.mjs';
import { r2Configured, r2Head, r2Put, r2PublicUrl } from '../scripts/r2.mjs';

export const config = { api: { bodyParser: false } };

const LIMIT = 250 << 20; // 250MB stream cap
const MAX_DIM = 1920;

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

async function normalizeImage(input, ext) {
  const { default: sharp } = await import('sharp');
  const resized = sharp(input)
    .resize(MAX_DIM, MAX_DIM, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();
  return resized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  let buf;
  try { buf = await readBody(req); }
  catch { res.status(413).json({ error: 'file too large (max 250MB)' }); return; }
  const part = parseUpload(buf, req.headers['content-type']);
  if (!part || !part.data.length) { res.status(400).json({ error: 'bad upload' }); return; }
  const ext = sniffMedia(part.data, part.filename);
  if (!ext) { res.status(400).json({ error: 'unsupported media type (images, svg, video, audio, fonts)' }); return; }
  const isImage = /^(png|jpg|jpeg|webp|gif|svg|avif|bmp|ico)$/.test(ext);
  if (isImage) {
    if (part.data.length > IMAGE_MAX) { res.status(413).json({ error: 'image too large (max 8MB)' }); return; }
    if (!sniffImage(part.data, ext)) { res.status(400).json({ error: 'invalid image format' }); return; }
  }
  const isBig = /^(mp4|m4v|mov|webm|mp3|wav|ogg|m4a)$/.test(ext);
  const doNorm = isImage && isResizable('i.' + ext);
  const finalData = doNorm ? await normalizeImage(part.data, ext) : part.data;
  const hash = contentHash(finalData);
  const finalExt = doNorm ? 'webp' : ext;
  const name = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
    hash + '.' + finalExt;
  if (r2Configured()) {
    try {
      const existing = await r2Head('custom/' + name).catch(() => false);
      if (existing) {
        res.status(200).json({ src: r2PublicUrl('custom/' + name), kind: isBig ? 'media' : 'image', deduped: true });
        return;
      }
      await r2Put('custom/' + name, finalData, doNorm ? 'image/webp' : (part.type || 'application/octet-stream'));
      res.status(200).json({ src: r2PublicUrl('custom/' + name), kind: isBig ? 'media' : 'image' });
    } catch (e) {
      console.error('[upload] r2 error:', e?.message || e);
      res.status(500).json({ error: 'upload failed', detail: String(e?.message || e).slice(0, 200) });
    }
    return;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put, head } = await import('@vercel/blob');
      const existing = await head('custom/' + name).catch(() => null);
      if (existing) {
        res.status(200).json({ src: existing.url, kind: isBig ? 'media' : 'image', deduped: true });
        return;
      }
      const blob = await put('custom/' + name, finalData, { access: 'public', contentType: doNorm ? 'image/webp' : (part.type || undefined), allowOverwrite: true });
      res.status(200).json({ src: blob.url, kind: isBig ? 'media' : 'image' });
    } catch (e) {
      console.error('[upload] blob error:', e?.message || e);
      res.status(500).json({ error: 'upload failed', detail: String(e?.message || e).slice(0, 200) });
    }
    return;
  }
  if (process.env.VERCEL) {
    res.status(500).json({ error: 'uploads not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL - or BLOB_READ_WRITE_TOKEN for legacy Vercel Blob)' });
    return;
  }
  const dir = path.join(process.cwd(), 'dist', 'assets', 'custom');
  await mkdir(dir, { recursive: true });
  const localPath = path.join(dir, name);
  try {
    await stat(localPath);
    res.status(200).json({ src: '/assets/custom/' + name, kind: isBig ? 'media' : 'image', deduped: true });
    return;
  } catch {}
  await writeFile(localPath, finalData);
  res.status(200).json({ src: '/assets/custom/' + name, kind: isBig ? 'media' : 'image' });
}
