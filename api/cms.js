// GET /api/cms (public: saved sections, ?section=x, ?live=1 snapshot)
// PUT /api/cms (admin: { section, data }).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getCMS, saveCMSSection, liveSnapshot, CMS_SECTIONS } from '../scripts/cms.mjs';
import { bustBrand, applyHomeStatic, FILE_CONTENT, LOGO_ROWS, LOGO_NAMES } from '../scripts/transform.mjs';
import { bustOverrides, getOverrides, applyOverrides } from '../scripts/overrides.mjs';
import { bustCMS } from '../scripts/cms.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fresh on every read (see api/page.js): shared storage, same view for all.
    if (process.env.VERCEL) bustCMS();
    res.setHeader('Cache-Control', 'no-store');
    const u = new URL(req.url, 'http://local');
    if (u.searchParams.get('live') === '1') {
      try {
        const file = path.join(process.cwd(), 'dist', 'index.html');
        let html = await readFile(file, 'utf8');
        // Prefill from the page as it is actually served, not the raw dist file.
        // Reading dist/index.html directly showed the admin the donor's copy
        // while the site served StillCraft's, so every field disagreed with the
        // page and a plain Save wrote the old data back.
        const dbItems = await getOverrides('/').catch(() => []);
        const fileItems = [...(FILE_CONTENT['/'] || []),
          ...((LOGO_ROWS['/'] || []).filter((r) => !/Testimonial/i.test(r.orig_html))),
          ...((LOGO_NAMES['/'] || []).map((n) => ({ el_id: n.id, kind: 'text', value: n.name, orig_html: n.old })))];
        html = applyOverrides(html, [...dbItems, ...fileItems], {});
        html = applyHomeStatic(html);
        res.status(200).json({ live: await liveSnapshot(html) });
      } catch {
        res.status(200).json({ live: {} });
      }
      return;
    }
    const cms = await getCMS();
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
    res.status(400).json({ error: String((e && e.message) || e).slice(0, 120) });
    return;
  }
  bustBrand();
  bustOverrides();
  bustCMS();
  res.status(200).json({ ok: true, section: String(body.section || '') });
}
