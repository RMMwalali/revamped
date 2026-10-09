// GET /api/content?page=… (public) + PUT /api/content (admin).
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getOverrides, saveOverrides, bustOverrides } from '../scripts/overrides.mjs';
import { bustBrand } from '../scripts/transform.mjs';
import { bustCMS } from '../scripts/cms.mjs';
import { withFreshReads } from '../scripts/storage.mjs';
import { sendSaveError } from '../scripts/save-error.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    const u = new URL(req.url, 'http://local');
    const page = String(u.searchParams.get('page') || '/');
    // Admins (the edit bar) get the authoritative copy, never a cached one.
    const admin = await verifySession(parseCookies(req).sc_admin).catch(() => null);
    if (admin) bustOverrides();
    const items = admin ? await withFreshReads(() => getOverrides(page)) : await getOverrides(page);
    res.status(200).json({ page, items });
    return;
  }
  if (req.method !== 'PUT') { res.status(405).send('method not allowed'); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const page = String(body.page || '/');
  const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
  const clean = items.map((it) => {
    if (!it || typeof it.el_id !== 'string' || !['text', 'image', 'media'].includes(it.kind)) return null;
    return {
      el_id: it.el_id.slice(0, 200),
      kind: it.kind,
      value: String(it.value || '').slice(0, 50000),
      orig_html: typeof it.orig === 'string' ? it.orig.slice(0, 50000) : null,
      idx: Math.max(0, Math.min(99, parseInt(it.idx, 10) || 0)),
      tag: typeof it.tag === 'string' ? it.tag.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : '',
    };
  }).filter(Boolean);
  try {
    await saveOverrides(page, clean, { merge: body.merge === true });
    bustBrand();
    bustCMS();
    res.status(200).json({ ok: true, saved: clean.length, items: await getOverrides(page) });
  } catch (e) {
    sendSaveError(res, 'content', e);
  }
}
