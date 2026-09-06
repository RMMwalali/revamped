// GET /api/brand (public) + PUT /api/brand (admin).
import { pool } from '../scripts/db.mjs';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getBrand, bustBrand } from '../scripts/transform.mjs';
import { bustOverrides } from '../scripts/overrides.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json(await getBrand());
    return;
  }
  if (req.method !== 'PUT') { res.status(405).send('method not allowed'); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const allowed = ['site_name', 'tagline', 'logo_src', 'primary_color', 'accent_color'];
  for (const k of allowed) {
    if (typeof body[k] === 'string') {
      await pool.query(
        'INSERT INTO brand_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
        [k, body[k].slice(0, 500)]
      );
    }
  }
  bustBrand();
  bustOverrides();
  res.status(200).json(await getBrand());
}
