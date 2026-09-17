// POST /api/upload (admin): media field "image", up to 8MB for images,
// 250MB for video/audio. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is
// set, else local disk (dev).
import crypto from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { parseUpload, sniffMedia, sniffImage, IMAGE_MAX } from '../scripts/transform.mjs';

export const config = { api: { bodyParser: false } };

const LIMIT = 250 << 20; // 250MB stream cap

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
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  let buf;
  try { buf = await readBody(req); }
  catch { res.status(413).json({ error: 'file too large (max 250MB)' }); return; }
  const part = parseUpload(buf, req.headers['content-type']);
  if (!part || !part.data.length) { res.status(400).json({ error: 'bad upload' }); return; }
  const ext = sniffMedia(part.data, part.filename);
  if (!ext) { res.status(400).json({ error: 'unsupported media type (images, svg, video, audio, fonts)' }); return; }
  // Images must be a common web format and ≤ 8MB.
  const isImage = /^(png|jpg|jpeg|webp|gif|svg|avif|bmp|ico)$/.test(ext);
  if (isImage) {
    if (part.data.length > IMAGE_MAX) { res.status(413).json({ error: 'image too large (max 8MB)' }); return; }
    if (!sniffImage(part.data, ext)) { res.status(400).json({ error: 'invalid image format' }); return; }
  }
  const isBig = /^(mp4|m4v|mov|webm|mp3|wav|ogg|m4a)$/.test(ext);
  const name = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
    crypto.randomBytes(4).toString('hex') + '.' + ext;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put('custom/' + name, part.data, { access: 'public', contentType: part.type || undefined });
    res.status(200).json({ src: blob.url, kind: isBig ? 'media' : 'image' });
    return;
  }
  if (process.env.VERCEL) {
    res.status(500).json({ error: 'uploads not configured (missing BLOB_READ_WRITE_TOKEN)' });
    return;
  }
  const dir = path.join(process.cwd(), 'dist', 'assets', 'custom');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), part.data);
  res.status(200).json({ src: '/assets/custom/' + name, kind: isBig ? 'media' : 'image' });
}
