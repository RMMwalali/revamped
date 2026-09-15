// Vercel serverless: serves transformed HTML pages (same pipeline as scripts/serve.mjs).
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getOverrides, applyOverrides, bustOverrides } from '../scripts/overrides.mjs';
import {
  getBrand, bustBrand, applyBrand, applyNav, applyGlobalSwaps, applyFooterAddresses, applyHeroVideo,
  applyContentFlight, stripThirdParty, applyImgDims, applySplash,
  applyStyleBlocks, applyFooterFix, applyTeamRoster,
  FILE_CONTENT, LOGO_ROWS, LOGO_NAMES, HERO_VIDEO_URL,
} from '../scripts/transform.mjs';
import { getCMS, bustCMS, applyStructuredCMS } from '../scripts/cms.mjs';

const ROOT = path.join(process.cwd(), 'dist');
const NO_FP = new Set(['/cookie-policy', '/privacy-policy', '/legal-notice-terms-of-use']);

function pageKey(pathname) {
  let p = (pathname || '/').replace(/\/index\.html$/, '');
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

function candidates(urlPath) {
  const raw = String(urlPath || '/').split('?')[0];
  const out = [];
  for (const c of [raw]) {
    try {
      const dec = decodeURIComponent(c);
      if (dec !== c) out.push(dec);
    } catch {}
    out.push(c);
  }
  return out.map((c) => path.normalize(path.join(ROOT, c))).filter((p) => p.startsWith(ROOT));
}

async function serveHtml(pathname, cookies) {
  // On Vercel, lambda instances are reused across visitors: drop module-level
  // caches so every page view reads fresh DB state. An edit saved by one
  // admin is then visible to everyone (and every region/instance) on the
  // very next refresh — no stale windows, no per-user divergence.
  if (process.env.VERCEL) { bustBrand(); bustOverrides(); bustCMS(); }
  let lookup = pathname;
  if (lookup.endsWith('/')) lookup += 'index.html';
  const tries = [];
  if (lookup.endsWith('.html') || path.extname(lookup) === '') {
    for (const f of candidates(lookup.endsWith('.html') ? lookup : lookup + '.html')) tries.push(f);
    for (const f of candidates(lookup)) tries.push(path.join(f, 'index.html'));
  }
  for (const file of tries) {
    let st;
    try { st = await stat(file); } catch { continue; }
    if (!st.isFile()) continue;
    const key = pageKey(pathname);
    let html = await readFile(file, 'utf8');
    if (!process.env.SC_NOSTRIP) html = stripThirdParty(html);
    html = applyBrand(html, await getBrand());
    if (!process.env.SC_NONAV) html = applyNav(html, key);
    const noFP = NO_FP.has(key);
    html = applyOverrides(html, await getOverrides(key), { noFlightPatch: noFP });
    const fileItems = [...(FILE_CONTENT[key] || []),
      ...((LOGO_ROWS[key] || []).filter((r) => !/Testimonial/i.test(r.orig_html))),
      ...((LOGO_NAMES[key] || []).map((n) => ({ el_id: n.id, kind: 'text', value: n.name, orig_html: n.old })))];
    if (fileItems.length) html = applyOverrides(html, fileItems, { noFlightPatch: noFP });
    html = applyGlobalSwaps(html, key);
    const __brand = await getBrand();
    const __cms = await getCMS().catch(() => null);
    const __heroUrl = (__cms && __cms.hero && __cms.hero.video_url) || __brand.hero_video_src || HERO_VIDEO_URL;
    html = applyHeroVideo(html, __heroUrl);
    if (__cms) html = applyStructuredCMS(html, __cms, key);
    html = applyFooterAddresses(html);
    html = applyContentFlight(html, key);
    html = applyTeamRoster(html);
    html = applyStyleBlocks(html, await getBrand());
    html = await applyImgDims(html);
    html = applySplash(html, key);
    html = applyFooterFix(html, key);
    const sess = await verifySession(cookies.sc_admin).catch(() => null);
    // /insider hosts the standalone mini-CMS dashboard (own auth UI):
    // never inject the floating inline edit bar there.
    if (sess && key !== '/insider') {
      html = html.replace(/(<\/body>)/i,
        `<script>window.__SC_PAGE__=${JSON.stringify(key)};window.__sc_boot=function(){if(window.__sc_editbar_on||!document.body)return;var s=document.createElement('script');s.src='/editbar.js';s.setAttribute('data-sc-boot','1');document.body.appendChild(s);};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',window.__sc_boot);}else{window.__sc_boot();}setTimeout(window.__sc_boot,2000);setTimeout(window.__sc_boot,5000);setTimeout(window.__sc_boot,9000);</script>\n$1`);
    }
    return { key, html };
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const u = new URL(req.url, `${proto}://${req.headers.host || 'local'}`);
    let pathname = u.searchParams.get('path') || u.pathname || '/';
    if (!pathname.startsWith('/')) pathname = '/' + pathname;
    if (pathname.startsWith('/cdn-cgi/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(204).end();
      return;
    }
    if (pathname === '/_next/image') {
      const src = u.searchParams.get('url');
      if (!src) { res.status(204).end(); return; }
      const target = src.startsWith('/') ? src : '/' + src;
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }
    if (/^\/projects\/page\/\d+\/?$/.test(pathname)) {
      res.writeHead(302, { Location: '/projects' });
      res.end();
      return;
    }
    const cookies = parseCookies(req);
    const found = await serveHtml(pathname, cookies);
    if (!found) { res.status(404).send('not found'); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(found.html);
  } catch (e) {
    res.status(500).send('error');
  }
}
