// GET /api/storage (admin): where admin saves are stored, whether that is
// permanent, and when each kind of content was last saved. Shown as a status
// line in /insider and the edit bar so a broken setup is visible immediately
// instead of after edits disappear.
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { storageInfo, listVersions } from '../scripts/storage.mjs';

const STORES = { 'cms.json': 'Homepage sections', 'overrides.json': 'Page text & media', 'brand.json': 'Brand settings' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'method not allowed' }); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  const info = storageInfo();
  const stores = {};
  if (req.url && req.url.includes('detail=1')) {
    await Promise.all(Object.keys(STORES).map(async (name) => {
      try {
        const v = await listVersions(name);
        stores[name] = { label: STORES[name], versions: v.length, last: v[0] ? (v[0].at || v[0].id) : null };
      } catch (e) {
        stores[name] = { label: STORES[name], error: String(e?.message || e).slice(0, 120) };
      }
    }));
  }
  res.status(200).json({ ...info, stores });
}
