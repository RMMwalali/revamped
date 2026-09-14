// GET /api/content?page=â€¦ (public) + PUT /api/content (admin).
import { pool } from '../scripts/db.mjs';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { bustOverrides } from '../scripts/overrides.mjs';
import { bustBrand } from '../scripts/transform.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const u = new URL(req.url, 'http://local');
    const page = String(u.searchParams.get('page') || '/');
    const r = await pool.query(
      'SELECT el_id, kind, value, orig_html, idx, tag FROM content_overrides WHERE page = $1',
      [page]
    ).catch(() => null);
    res.status(200).json({ page, items: r ? r.rows : [] });
    return;
  }
  if (req.method !== 'PUT') { res.status(405).send('method not allowed'); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const page = String(body.page || '/');
  const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
  for (const it of items) {
    if (!it || typeof it.el_id !== 'string' || !['text', 'image', 'media'].includes(it.kind)) continue;
    const value = String(it.value || '').slice(0, 50000);
    const orig = typeof it.orig === 'string' ? it.orig.slice(0, 50000) : null;
    const idx = Math.max(0, Math.min(99, parseInt(it.idx, 10) || 0));
    const tag = typeof it.tag === 'string' ? it.tag.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : '';
    await pool.query(
      `INSERT INTO content_overrides (page, el_id, kind, value, orig_html, idx, tag, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (page, el_id) DO UPDATE SET kind = EXCLUDED.kind, value = EXCLUDED.value, orig_html = EXCLUDED.orig_html, idx = EXCLUDED.idx, tag = EXCLUDED.tag, updated_at = now()`,
      [page, it.el_id.slice(0, 200), it.kind, value, orig, idx, tag]
    );
  }
  bustBrand();
  bustOverrides();
  res.status(200).json({ ok: true, saved: items.length });
}
