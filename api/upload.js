// POST /api/upload (admin): single image field "image", max 8MB.
// Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set, else local disk (dev).
import crypto from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { parseUpload, sniffImage } from '../scripts/transform.mjs';

export const config = { api: { bodyParser: false } };

function readBody(req, limit = 9 << 20) {
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
  catch { res.status(413).json({ error: 'file too large (max 8MB)' }); return; }
  const part = parseUpload(buf, req.headers['content-type']);
  if (!part || part.data.length > (8 << 20)) { res.status(400).json({ error: 'bad upload' }); return; }
  const ext = sniffImage(part.data, part.filename);
  if (!ext) { res.status(400).json({ error: 'only png/jpg/webp/gif/svg images' }); return; }
  const name = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
    crypto.randomBytes(4).toString('hex') + '.' + ext;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put('custom/' + name, part.data, { access: 'public' });
    res.status(200).json({ src: blob.url });
    return;
  }
  if (process.env.VERCEL) {
    res.status(500).json({ error: 'uploads not configured (missing BLOB_READ_WRITE_TOKEN)' });
    return;
  }
  const dir = path.join(process.cwd(), 'dist', 'assets', 'custom');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), part.data);
  res.status(200).json({ src: '/assets/custom/' + name });
}
