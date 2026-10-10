// POST /api/storage (admin) { action: 'import-blob' | 'move-blob-files' }:
// the Vercel Blob -> R2 move (scripts/migrate-blob.mjs).
// GET /api/storage (admin): where admin saves are stored, whether that is
// permanent, and when each kind of content was last saved. Shown as a status
// line in /insider and the edit bar so a broken setup is visible immediately
// instead of after edits disappear.
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { storageInfo, listVersions, probeStorage, hasLegacyBlob } from '../scripts/storage.mjs';
import { importBlobData, moveBlobFiles } from '../scripts/migrate-blob.mjs';
import { bustCMS } from '../scripts/cms.mjs';
import { bustOverrides } from '../scripts/overrides.mjs';
import { bustBrand } from '../scripts/transform.mjs';
import { emailHandler } from '../scripts/email-api.mjs';

const STORES = { 'cms.json': 'Homepage sections', 'overrides.json': 'Page text & media', 'brand.json': 'Brand settings' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // /api/email is routed here (vercel.json) to stay within the 12-function limit.
  const url = String(req.url || '');
  if (url.startsWith('/api/email') || /[?&]kind=email\b/.test(url)) return emailHandler(req, res);
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (req.method === 'POST') {
    const action = String((req.body && req.body.action) || '');
    try {
      let result;
      if (action === 'import-blob') result = { imported: await importBlobData() };
      else if (action === 'move-blob-files') result = { files: await moveBlobFiles() };
      else { res.status(400).json({ error: 'unknown action' }); return; }
      bustCMS(); bustOverrides(); bustBrand();
      res.status(200).json({ ok: true, ...result });
    } catch (e) {
      console.error('[storage] ' + action + ' failed:', e?.message || e);
      res.status(500).json({ error: 'failed', detail: String(e?.message || e).slice(0, 400) });
    }
    return;
  }
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
  const probe = await probeStorage();
  res.status(200).json({ ...info, probe, stores, legacyBlob: info.backend === 'r2' && hasLegacyBlob() });
}
