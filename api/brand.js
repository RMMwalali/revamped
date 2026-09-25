// GET /api/brand (public) + PUT /api/brand (admin).
import { readStore, writeStore } from '../scripts/storage.mjs';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getBrand, bustBrand, saveBrand } from '../scripts/transform.mjs';
import { bustOverrides } from '../scripts/overrides.mjs';
import { bustCMS } from '../scripts/cms.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (process.env.VERCEL) bustBrand();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await getBrand());
    return;
  }
  if (req.method !== 'PUT') { res.status(405).send('method not allowed'); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const allowed = ['site_name', 'tagline', 'logo_src', 'primary_color', 'accent_color', 'hero_video_src'];
  const updates = {};
  for (const k of allowed) {
    if (typeof body[k] === 'string') updates[k] = body[k].slice(0, 500);
  }
  try {
    await saveBrand(updates);
    bustOverrides();
    bustCMS();
    res.status(200).json(await getBrand());
  } catch (e) {
    console.error('[brand] save error:', e?.message || e);
    res.status(500).json({ error: 'save failed', detail: String(e?.message || e).slice(0, 200) });
  }
}
