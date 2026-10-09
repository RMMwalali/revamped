// GET /api/brand (public) + PUT /api/brand (admin).
import { withFreshReads } from '../scripts/storage.mjs';
import { sendSaveError } from '../scripts/save-error.mjs';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getBrand, bustBrand, saveBrand } from '../scripts/transform.mjs';
import { bustOverrides } from '../scripts/overrides.mjs';
import { bustCMS } from '../scripts/cms.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    bustBrand();
    res.setHeader('Cache-Control', 'no-store');
    const admin = await verifySession(parseCookies(req).sc_admin).catch(() => null);
    res.status(200).json(admin ? await withFreshReads(() => getBrand()) : await getBrand());
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
    res.status(200).json(await withFreshReads(() => getBrand()));
  } catch (e) {
    sendSaveError(res, 'brand', e);
  }
}
