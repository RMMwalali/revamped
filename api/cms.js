// GET /api/cms (public: saved sections, ?section=x, ?live=1 snapshot)
// PUT /api/cms (admin: { section, data }).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getCMS, saveCMSSection, liveSnapshot, CMS_SECTIONS } from '../scripts/cms.mjs';
import { serveHtml } from './page.js';
import { bustBrand } from '../scripts/transform.mjs';
import { bustOverrides } from '../scripts/overrides.mjs';
import { bustCMS } from '../scripts/cms.mjs';
import { withFreshReads } from '../scripts/storage.mjs';
import { sendSaveError } from '../scripts/save-error.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fresh on every read (see api/page.js): shared storage, same view for all.
    if (process.env.VERCEL) bustCMS();
    res.setHeader('Cache-Control', 'no-store');
    const u = new URL(req.url, 'http://local');
    if (u.searchParams.get('live') === '1') {
      try {
        // The home page exactly as a visitor gets it (saved CMS sections +
        // edit-bar edits), so every form opens on what is live.
        const cms = await getCMS().catch(() => ({}));
        const { html } = await serveHtml('/home', {}, req.headers && req.headers.host);
        res.status(200).json({ live: await liveSnapshot(html, cms) });
      } catch {
        res.status(200).json({ live: {} });
      }
      return;
    }
    // The admin form loads what it is about to edit: use the authoritative
    // copy, so saving a section never writes back a stale value.
    bustCMS();
    const admin = await verifySession(parseCookies(req).sc_admin).catch(() => null);
    const cms = admin ? await withFreshReads(() => getCMS()) : await getCMS();
    const only = String(u.searchParams.get('section') || '');
    if (only) {
      if (!CMS_SECTIONS.includes(only)) { res.status(400).json({ error: 'unknown section' }); return; }
      res.status(200).json({ section: only, data: cms[only] || {} });
      return;
    }
    res.status(200).json({ sections: cms });
    return;
  }
  if (req.method !== 'PUT') { res.status(405).send('method not allowed'); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    await saveCMSSection(String(body.section || ''), body.data);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg === 'unknown section' || msg === 'bad data') { res.status(400).json({ error: msg }); return; }
    sendSaveError(res, 'cms', e);
    return;
  }
  bustBrand();
  bustOverrides();
  bustCMS();
  res.status(200).json({ ok: true, section: String(body.section || '') });
}
