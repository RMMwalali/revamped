// Vercel serverless: serves transformed HTML pages (same pipeline as scripts/serve.mjs).
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession } from '../scripts/auth.mjs';
import { getOverrides, applyOverrides, applyAssetOverrides, bustOverrides } from '../scripts/overrides.mjs';
import {
  getBrand, bustBrand, applyBrand, applyNav, applyGlobalSwaps, applyLegalFix, applyFooterAddresses, applyHeroVideo,
  applyContentFlight, stripThirdParty, removeBadges, applyImgDims, encodeAssetSpaces, removeStaleProjectCards, applySplash,
  applyStyleBlocks, applyFooterFix, applyHomeVoices, applyStatsFix, applyCitiesFix, applyLogosFix, applyFooterSingleOffice, applyHighlightsFix, applySliderFix, applyShareImage, applyMetaFix, applyValuesFix, applyServiceCardsFix, applyListingStaticFix, applyPortfolioFix, applySplitTextFix, applyCardTitlesFix, applyRevealFailsafe, applyCaseMetaFix, applyAboutTeamRemove, applyAboutTeamReplace,
  FILE_CONTENT, LOGO_ROWS, LOGO_NAMES, HERO_VIDEO_URL,
  HERO_VIDEO_MOBILE_URL, HERO_POSTER_URL, mobileFor, posterFor, applyLinks, normalizeChunkRefs,
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

async function serveHtml(pathname, cookies, host) {
  // Freshness vs speed: admins (valid session) bypass caches so edits preview
  // instantly; public visitors share the warm module caches (brand 60s,
  // CMS/overrides 15s TTLs). Busting on every request forced ~5 sequential
  // DB roundtrips per page view - the main cause of production slowness.
  let isAdmin = false;
  if (cookies && cookies.sc_admin) {
    try { isAdmin = !!(await verifySession(cookies.sc_admin)); } catch { isAdmin = false; }
  }
  if (process.env.VERCEL && isAdmin) { bustBrand(); bustOverrides(); bustCMS(); }
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
    html = normalizeChunkRefs(html);
    if (!process.env.SC_NOSTRIP) html = stripThirdParty(html);
    html = removeBadges(html);
    // Independent DB reads run concurrently, not sequentially.
    const [__brand, __overrides, __cms] = await Promise.all([
      getBrand(),
      getOverrides(key),
      getCMS().catch(() => null),
    ]);
    html = applyBrand(html, __brand);
    if (!process.env.SC_NONAV) html = applyNav(html, key);
    const noFP = NO_FP.has(key);
    // Single overrides pass (DB items then file items, same order as the old
    // two-pass sequence) so the document is scanned once, not twice.
    const fileItems = [...(FILE_CONTENT[key] || []),
      ...((LOGO_ROWS[key] || []).filter((r) => !/Testimonial/i.test(r.orig_html))),
      ...((LOGO_NAMES[key] || []).map((n) => ({ el_id: n.id, kind: 'text', value: n.name, orig_html: n.old })))];
    html = applyOverrides(html, [...__overrides, ...fileItems], { noFlightPatch: noFP });
    html = applyGlobalSwaps(html, key);
    if (NO_FP.has(key)) html = applyLegalFix(html);
    const __heroUrl = (__cms && __cms.hero && __cms.hero.video_url) || __brand.hero_video_src || HERO_VIDEO_URL;
    const __heroMob = (__cms && __cms.hero && __cms.hero.video_mobile_url) || mobileFor(__heroUrl) || HERO_VIDEO_MOBILE_URL;
    const __heroPos = posterFor(__heroUrl) || HERO_POSTER_URL;
    html = applyHeroVideo(html, __heroUrl, __heroMob, __heroPos);
    if (__cms) html = await applyStructuredCMS(html, __cms, key);
    html = applyStatsFix(html);
    html = applyCitiesFix(html);
    html = applyLogosFix(html, __cms && __cms.logos && Array.isArray(__cms.logos.items) ? __cms.logos.items : []);
    html = applyFooterSingleOffice(html);
    html = applyHighlightsFix(html, key);
    html = applySliderFix(html, key);
    html = applyHomeVoices(html, key, __cms);
    html = applyShareImage(html);
    html = applyMetaFix(html, key);
    html = applyValuesFix(html, key);
    html = applyServiceCardsFix(html, key);
    html = applyListingStaticFix(html);
    html = applyPortfolioFix(html);
    html = applySplitTextFix(html);
    html = applyCardTitlesFix(html);
    html = applyCaseMetaFix(html, key);
    html = applyFooterAddresses(html);
    html = applyContentFlight(html, key);
    // Admin asset swaps target flight payload the content fixes above rewrite,
    // so re-assert them here or hydration re-renders the original file.
    if (!noFP) html = applyAssetOverrides(html, __overrides);
    html = applyLinks(html, host, key);
    html = applyAboutTeamRemove(html);
    html = applyRevealFailsafe(html);
    html = applyAboutTeamReplace(html, __cms);
    html = applyStyleBlocks(html, __brand);
    html = await applyImgDims(html);
    html = encodeAssetSpaces(html);
    html = removeStaleProjectCards(html);
    html = applySplash(html, key);
    html = applyFooterFix(html, key);
    // /insider hosts the standalone mini-CMS dashboard (own auth UI):
    // never inject the floating inline edit bar there.
    if (isAdmin && key !== '/insider') {
      html = html.replace(/(<\/body>)/i,
        `<script>window.__SC_PAGE__=${JSON.stringify(key)};window.__sc_boot=function(){if(window.__sc_editbar_on||!document.body)return;var s=document.createElement('script');s.src='/editbar.js';s.setAttribute('data-sc-boot','1');document.body.appendChild(s);};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',window.__sc_boot);}else{window.__sc_boot();}setTimeout(window.__sc_boot,2000);setTimeout(window.__sc_boot,5000);setTimeout(window.__sc_boot,9000);</script>\n$1`);
    }
    return { key, html, isAdmin };
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
    if (pathname === '/project/mothers-day-brunch-at-southfield-mall' || pathname.startsWith('/project/mothers-day-brunch-at-southfield-mall/')
      || pathname === '/project/adidas-display-wall' || pathname.startsWith('/project/adidas-display-wall/')
      || pathname === '/project/uefa-champions-league-final-2026' || pathname.startsWith('/project/uefa-champions-league-final-2026/')
      || pathname === '/project/ypo-global-event' || pathname.startsWith('/project/ypo-global-event/')) {
      res.writeHead(302, { Location: '/projects' });
      res.end();
      return;
    }
    if (pathname === '/insights' || pathname.startsWith('/insights/') || pathname === '/insight' || pathname.startsWith('/insight/')) {
      res.writeHead(302, { Location: '/contact' });
      res.end();
      return;
    }
    if (pathname === '/service/sports' || pathname.startsWith('/service/sports/')) {
      res.writeHead(302, { Location: '/projects' });
      res.end();
      return;
    }
    const cookies = parseCookies(req);
    const found = await serveHtml(pathname, cookies, req.headers.host);
    if (!found) { res.status(404).send('not found'); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Public pages are edge-cached (60s fresh, background revalidate after)
    // so repeat views skip the DB + transform pipeline entirely. Admins get
    // no-cache so edits preview instantly.
    res.setHeader('Cache-Control', found.isAdmin
      ? 'no-cache'
      : 'public, s-maxage=60, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(found.html);
  } catch (e) {
    res.status(500).send('error');
  }
}
