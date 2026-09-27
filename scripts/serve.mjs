// StillCraft Events — app server.
// Static clone host + admin backend (auth, content overrides, brand, uploads).
// - Serves dist/ with directory -> index.html resolution.
// - Shims Next.js image optimizer: /_next/image?url=<enc>&w=..&q=.. -> local file.
// - /insider serves the admin login page.
// - Authenticated admins get editbar.js injected into pages.
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, verifySession, login, logout, sessionCookie, clearCookie } from './auth.mjs';
import { saveLead } from '../api/lead.js';
import { readStore } from './storage.mjs';
import { getOverrides, applyOverrides, applyAssetOverrides, bustOverrides, saveOverrides, maskT } from './overrides.mjs';
import {
  getBrand, bustBrand, saveBrand, applyBrand, applyNav, applyTheme, stripThirdParty, removeBadges,
  parseUpload, sniffMedia, sniffImage, IMAGE_MAX,
  applyGlobalSwaps, applyLegalFix, applyFooterAddresses, applyHeroVideo,
  applyContentFlight, applyLinks, applyImgDims, encodeAssetSpaces, removeStaleProjectCards, applySplash, applyStyleBlocks,
  applyFooterFix, applyAboutTeamRemove, applyAboutTeamReplace, applyRevealFailsafe, applyStatsFix, applyCitiesFix, applyLogosFix, applyFooterSingleOffice, applyHighlightsFix, applySliderFix, applyShareImage, applyMetaFix, applyValuesFix,   applyServiceCardsFix, applyListingStaticFix, applyPortfolioFix, applySplitTextFix, applyCardTitlesFix, applyCaseMetaFix, FILE_CONTENT, LOGO_ROWS, LOGO_NAMES, HERO_VIDEO_URL,
  HERO_VIDEO_MOBILE_URL, HERO_POSTER_URL, mobileFor, posterFor, normalizeChunkRefs,
} from './transform.mjs';
import { getCMS, bustCMS, saveCMSSection, liveSnapshot, applyStructuredCMS, CMS_SECTIONS } from './cms.mjs';
const ROOT = path.resolve('dist');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};


function resolveFile(urlPath) {
  const raw = urlPath.split('?')[0];
  const candidates = [raw];
  try {
    const dec = decodeURIComponent(raw);
    if (dec !== raw) candidates.unshift(dec);
  } catch {}
  const out = [];
  for (const c of candidates) {
    const p = path.normalize(path.join(ROOT, c));
    if (p.startsWith(ROOT)) out.push(p);
  }
  return out;
}

async function sendFile(res, file, noCache) {
  try {
    const st = await stat(file);
    if (!st.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': noCache || ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
    return true;
  } catch { return false; }
}

// Resized image variants (/_next/image?w=..&q=..). Memory-capped; sharp is a
// hard dependency. Returns null on any failure so callers fall back to the
// original bytes - never a 500 for an image.
const RESIZE_CACHE = new Map();
const RESIZE_CACHE_MAX = 40;
const RESIZE_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };
async function resizedImage(file, w, q) {
  const ext = path.extname(file).toLowerCase();
  if (!RESIZE_MIME[ext]) return null;
  const key = file + '|' + w + '|' + q;
  const hit = RESIZE_CACHE.get(key);
  if (hit) {
    RESIZE_CACHE.delete(key);
    RESIZE_CACHE.set(key, hit);
    return hit;
  }
  const { default: sharp } = await import('sharp');
  const input = await readFile(file);
  const meta = await sharp(input).metadata();
  if (meta.width && meta.width <= w) return null; // never upscale
  let pipe = sharp(input).resize({ width: w, withoutEnlargement: true });
  if (ext === '.jpg' || ext === '.jpeg') pipe = pipe.jpeg({ quality: q, mozjpeg: true });
  else if (ext === '.png') pipe = pipe.png({ quality: q });
  else if (ext === '.webp') pipe = pipe.webp({ quality: q });
  else if (ext === '.gif') pipe = pipe.gif();
  else if (ext === '.avif') pipe = pipe.avif({ quality: q });
  const buf = await pipe.toBuffer();
  const out = { buf, type: RESIZE_MIME[ext] };
  if (RESIZE_CACHE.size >= RESIZE_CACHE_MAX) RESIZE_CACHE.delete(RESIZE_CACHE.keys().next().value);
  RESIZE_CACHE.set(key, out);
  return out;
}

function readBody(req, limit = 1 << 20) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, code, obj, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Set-Cookie'] = cookie;
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}

function pageKey(pathname) {
  let p = pathname.replace(/\/index\.html$/, '');
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

// Login rate limit: in-memory (same pattern as api/login.js). On Vercel the
// serverless function restarts can reset it, but it still deters naive brute
// force against the env-var admin credentials.
const LOCK_MINUTES = 5;
const MAX_FAILS = 5;
const attempts = new Map();

function rateLimited(ip) {
  const a = attempts.get(ip);
  return !!(a && a.lockedUntil > Date.now());
}
function rateFail(ip) {
  const a = attempts.get(ip) || { fails: 0, lockedUntil: 0 };
  a.fails++;
  if (a.fails >= MAX_FAILS) { a.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000; a.fails = 0; }
  attempts.set(ip, a);
}
function rateClear(ip) { attempts.delete(ip); }


const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://local');
    let pathname = u.pathname;
    const method = req.method;
    const cookies = parseCookies(req);

    // ----- API -----
    if (pathname === '/api/login' && method === 'POST') {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'x';
      if (rateLimited(ip)) return json(res, 429, { error: 'too many attempts, try later' });
      let body;
      try { body = JSON.parse((await readBody(req)).toString('utf8')); }
      catch { return json(res, 400, { error: 'bad request' }); }
      const sess = await login(String(body.email || ''), String(body.password || '')).catch(() => null);
      if (!sess) { rateFail(ip); return json(res, 401, { error: 'invalid credentials' }); }
      rateClear(ip);
      return json(res, 200, { email: sess.email }, sessionCookie(sess.token, sess.expires));
    }
    if (pathname === '/api/logout' && method === 'POST') {
      await logout(cookies.sc_admin).catch(() => {});
      return json(res, 200, { ok: true }, clearCookie());
    }
    if (pathname === '/api/me' && method === 'GET') {
      const s = await verifySession(cookies.sc_admin).catch(() => null);
      if (!s) return json(res, 401, { error: 'unauthorized' });
      return json(res, 200, { email: s.email });
    }
    if (pathname === '/api/content' && method === 'GET') {
      const page = String(u.searchParams.get('page') || '/');
      const items = await getOverrides(page);
      return json(res, 200, { page, items });
    }
    if (pathname === '/api/content' && method === 'PUT') {
      const s = await verifySession(cookies.sc_admin).catch(() => null);
      if (!s) return json(res, 401, { error: 'unauthorized' });
      let body;
      try { body = JSON.parse((await readBody(req, 5 << 20)).toString('utf8')); }
      catch { return json(res, 400, { error: 'bad request' }); }
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
      await saveOverrides(page, clean);
      bustOverrides();
      return json(res, 200, { ok: true, saved: clean.length });
    }
    if (pathname === '/api/cms' && method === 'GET') {
      const only = String(u.searchParams.get('section') || '');
      if (u.searchParams.get('live') === '1') {
        try {
          const liveHtml = await readFile(path.join(ROOT, 'index.html'), 'utf8');
          return json(res, 200, { live: await liveSnapshot(liveHtml) });
        } catch { return json(res, 200, { live: {} }); }
      }
      const cms = await getCMS();
      if (only) {
        if (!CMS_SECTIONS.includes(only)) return json(res, 400, { error: 'unknown section' });
        return json(res, 200, { section: only, data: cms[only] || {} });
      }
      return json(res, 200, { sections: cms });
    }
    if (pathname === '/api/cms' && method === 'PUT') {
      const s = await verifySession(cookies.sc_admin).catch(() => null);
      if (!s) return json(res, 401, { error: 'unauthorized' });
      let body;
      try { body = JSON.parse((await readBody(req, 5 << 20)).toString('utf8')); }
      catch { return json(res, 400, { error: 'bad request' }); }
      try { await saveCMSSection(String(body.section || ''), body.data); }
      catch (e) { return json(res, 400, { error: String((e && e.message) || e).slice(0, 120) }); }
      bustBrand();
      bustOverrides();
      bustCMS();
      return json(res, 200, { ok: true, section: String(body.section || '') });
    }
    if (pathname === '/api/brand' && method === 'GET') {
      return json(res, 200, await getBrand());
    }
    if (pathname === '/api/brand' && method === 'PUT') {
      const s = await verifySession(cookies.sc_admin).catch(() => null);
      if (!s) return json(res, 401, { error: 'unauthorized' });
      let body;
      try { body = JSON.parse((await readBody(req)).toString('utf8')); }
      catch { return json(res, 400, { error: 'bad request' }); }
      const allowed = ['site_name', 'tagline', 'logo_src', 'primary_color', 'accent_color', 'hero_video_src'];
      const updates = {};
      for (const k of allowed) {
        if (typeof body[k] === 'string') updates[k] = body[k].slice(0, 500);
      }
      await saveBrand(updates);
      bustOverrides();
      bustCMS();
      return json(res, 200, await getBrand());
    }
    // Form submissions. saveLead is imported from api/lead.js rather than
    // reimplemented — a hand-duplicated handler here is what let the login
    // fix drift out of sync once already.
    if (pathname === '/api/lead' && method === 'POST') {
      const ctype = String(req.headers['content-type'] || '');
      if (ctype.includes('multipart/form-data')) return json(res, 200, { ok: true });
      let body;
      try { body = JSON.parse((await readBody(req)).toString('utf8')); }
      catch { return json(res, 400, { error: 'bad request' }); }
      const leadIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
        .split(',')[0].trim().slice(0, 64);
      try {
        const r = await saveLead(body, leadIp);
        if (!r.ok) return json(res, 400, { error: r.error });
        return json(res, 200, { ok: true });
      } catch (e) {
        console.error('lead insert failed:', String((e && e.code) || 'unknown'));
        return json(res, 500, { error: 'could not save' });
      }
    }
    if (pathname === '/api/leads' && method === 'GET') {
      const s = await verifySession(cookies.sc_admin).catch(() => null);
      if (!s) return json(res, 401, { error: 'unauthorized' });
      const limit = Math.min(500, Math.max(1, parseInt(u.searchParams.get('limit') || '100', 10) || 100));
      const leads = await readStore('leads.json') || [];
      const rows = leads.slice().sort((a, b) => b.created_at - a.created_at).slice(0, limit)
        .map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
      return json(res, 200, { leads: rows });
    }
    if (pathname === '/api/upload' && method === 'POST') {
      const s = await verifySession(cookies.sc_admin).catch(() => null);
      if (!s) return json(res, 401, { error: 'unauthorized' });
      let buf;
      try { buf = await readBody(req, 250 << 20); }
      catch { return json(res, 413, { error: 'file too large (max 250MB)' }); }
      const part = parseUpload(buf, req.headers['content-type']);
      if (!part || !part.data.length) return json(res, 400, { error: 'bad upload' });
      const ext = sniffMedia(part.data, part.filename);
      if (!ext) return json(res, 400, { error: 'unsupported media type (images, svg, video, audio, fonts)' });
      const isImage = /^(png|jpg|jpeg|webp|gif|svg|avif|bmp|ico)$/.test(ext);
      if (isImage) {
        if (part.data.length > IMAGE_MAX) return json(res, 413, { error: 'image too large (max 8MB)' });
        if (!sniffImage(part.data, ext)) return json(res, 400, { error: 'invalid image format' });
      }
      const isBig = /^(mp4|m4v|mov|webm|mp3|wav|ogg|m4a)$/.test(ext);
      const name = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
        crypto.randomBytes(4).toString('hex') + '.' + ext;
      await mkdir(path.join(ROOT, 'assets', 'custom'), { recursive: true });
      await writeFile(path.join(ROOT, 'assets', 'custom', name), part.data);
      return json(res, 200, { src: '/assets/custom/' + name, kind: isBig ? 'media' : 'image' });
    }

    if (pathname.startsWith('/cdn-cgi/')) {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }

    // ----- paginated project lists have no static equivalent: redirect to index -----
    if (/^\/projects\/page\/\d+\/?$/.test(pathname)) {
      res.writeHead(302, { Location: '/projects', 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
    // removed case-study slugs (template projects, not StillCraft cases)
    if (pathname === '/project/mothers-day-brunch-at-southfield-mall' || pathname.startsWith('/project/mothers-day-brunch-at-southfield-mall/')
      || pathname === '/project/adidas-display-wall' || pathname.startsWith('/project/adidas-display-wall/')
      || pathname === '/project/uefa-champions-league-final-2026' || pathname.startsWith('/project/uefa-champions-league-final-2026/')
      || pathname === '/project/ypo-global-event' || pathname.startsWith('/project/ypo-global-event/')) {
      res.writeHead(302, { Location: '/projects', 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
    // blog removed - redirect to contact
    if (pathname === '/insights' || pathname.startsWith('/insights/') || pathname === '/insight' || pathname.startsWith('/insight/')) {
      res.writeHead(302, { Location: '/contact', 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
    // sports service retired (no StillCraft lane) - redirect to projects
    if (pathname === '/service/sports' || pathname.startsWith('/service/sports/')) {
      res.writeHead(302, { Location: '/projects', 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
    // category pages have no static equivalent: serve /projects
    if (pathname === '/projects/mall-activations' || pathname.startsWith('/projects/mall-activations/')) {
      pathname = '/projects';
    }
    // /projects/filter is a dynamic route (client-side filtering) with no static
    // equivalent: redirect to the static /projects listing.
    if (pathname === '/projects/filter' || pathname.startsWith('/projects/filter/')) {
      res.writeHead(302, { Location: '/projects', 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }

    // ----- Next.js image optimizer shim (real resizing: variants serve the
    // requested width, not the full original) -----
    if (pathname === '/_next/image') {
      const src = u.searchParams.get('url');
      if (!src) {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
        res.end();
        return;
      }
      let target = src;
      try { target = decodeURIComponent(src); } catch {}
      if (target.startsWith('https://cms.iventions.com/')) {
        target = '/assets/cms/' + target.replace('https://cms.iventions.com/', '');
      } else if (!target.startsWith('/')) {
        target = '/' + target;
      }
      const rawW = Math.min(3840, Math.max(0, parseInt(u.searchParams.get('w') || '0', 10) || 0));
      const ALLOWED_W = [640, 750, 828, 1080, 1200, 1920, 3840];
      const w = rawW ? ALLOWED_W.find((a) => a >= rawW) || 3840 : 0;
      const q = Math.min(100, Math.max(10, parseInt(u.searchParams.get('q') || '75', 10) || 75));
      for (const f of resolveFile(target)) {
        const ext = path.extname(f).toLowerCase();
        if (!w || ext === '.svg' || ext === '.ico') {
          if (await sendFile(res, f)) return;
          continue;
        }
        const resized = await resizedImage(f, w, q).catch(() => null);
        if (resized) {
          res.writeHead(200, {
            'Content-Type': resized.type,
            'Content-Length': resized.buf.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(resized.buf);
          return;
        }
        if (await sendFile(res, f)) return;
      }
      res.writeHead(302, { Location: target, 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }

    // ----- static / pages -----
    let lookup = pathname;
    if (lookup.endsWith('/')) lookup += 'index.html';
    for (const f of resolveFile(lookup)) {
      if (f.toLowerCase().endsWith('.html')) continue; // HTML goes through brand/override pipeline below
      if (f.toLowerCase().endsWith('.css') && (lookup.includes('/_next/') || lookup.includes('/assets/'))) {
        try {
          const st = await stat(f);
          if (st.isFile()) {
            let css = await readFile(f, 'utf8');
            css = applyTheme(css, await getBrand());
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'Access-Control-Allow-Origin': '*' });
            res.end(css);
            return;
          }
        } catch {}
        continue;
      }
      if (await sendFile(res, f)) return;
    }
    // NOTE: no raw clean-URL fallback here — extensionless routes must flow
    // into the serveHtml pipeline below (brand/nav/overrides + admin inject).
    // HTML with admin injection + brand + overrides
    async function serveHtml(file) {
      const st = await stat(file);
      if (!st.isFile()) return false;
      const key = pageKey(pathname);
      let html = await readFile(file, 'utf8');
      html = normalizeChunkRefs(html);
      if (!process.env.SC_NOSTRIP) html = stripThirdParty(html);
      html = removeBadges(html);
      html = applyBrand(html, await getBrand());
      if (!process.env.SC_NONAV) html = applyNav(html, key);
      // Nav-link tracing, kept for diagnosing the pipeline but off by default:
      // it scanned the whole document 33 times per render and logged to stderr
      // on every request. Set SC_DEBUG_NAV=1 to turn it back on.
      const __dbgNav = !!process.env.SC_DEBUG_NAV;
      const __dbg_nav = __dbgNav ? (html.match(/href="\/projects"/g) || []).length : 0;
      const __dbg_step = __dbgNav
        ? (label) => { const c = (html.match(/href="\/projects"/g) || []).length; if (c !== __dbg_nav) console.error(`[serve] ${label}: ${c}`); return c; }
        : () => 0;
      // Legal pages have no below-root error boundary: a flight patch that the
      // client parses as a truncated stream fatals the whole page, so serve
      // them static-only (a 418 revert beats an Application error).
      const noFP = key === '/cookie-policy' || key === '/privacy-policy' || key === '/legal-notice-terms-of-use';
      // Single overrides pass (DB items then file items, same order as the old
      // two-pass sequence) so the document is scanned once, not twice.
      const fileItems = [...(FILE_CONTENT[key] || []),
        ...((LOGO_ROWS[key] || []).filter(r => !/Testimonial/i.test(r.orig_html))),
        ...((LOGO_NAMES[key] || []).map(n => ({ el_id: n.id, kind: 'text', value: n.name, orig_html: n.old })))];
      const __dbItems = await getOverrides(key);
      html = applyOverrides(html, [...__dbItems, ...fileItems], { noFlightPatch: noFP });
      __dbg_step('overrides');
      html = applyGlobalSwaps(html, key);
      __dbg_step('globalSwaps');
      if (key === '/cookie-policy' || key === '/privacy-policy' || key === '/legal-notice-terms-of-use') html = applyLegalFix(html);
      const __brand = await getBrand();
      const __cms = await getCMS().catch(() => null);
      const __heroUrl = (__cms && __cms.hero && __cms.hero.video_url) || __brand.hero_video_src || HERO_VIDEO_URL;
      const __heroMob = (__cms && __cms.hero && __cms.hero.video_mobile_url) || mobileFor(__heroUrl) || HERO_VIDEO_MOBILE_URL;
      const __heroPos = posterFor(__heroUrl) || HERO_POSTER_URL;
      html = applyHeroVideo(html, __heroUrl, __heroMob, __heroPos);
      __dbg_step('heroVideo');
      if (__cms) html = await applyStructuredCMS(html, __cms, key);
      __dbg_step('cms');
      html = applyStatsFix(html);
      __dbg_step('statsFix');
      html = applyCitiesFix(html);
      __dbg_step('citiesFix');
      html = applyLogosFix(html, __cms && __cms.logos && Array.isArray(__cms.logos.items) ? __cms.logos.items : []);
      __dbg_step('logosFix');
      html = applyFooterSingleOffice(html);
      __dbg_step('footerSingleOffice');
      html = applyHighlightsFix(html, key);
      __dbg_step('highlightsFix');
      html = applySliderFix(html, key);
      __dbg_step('sliderFix');
      html = applyShareImage(html);
      __dbg_step('shareImage');
      html = applyMetaFix(html, key);
      __dbg_step('metaFix');
      html = applyValuesFix(html, key);
      __dbg_step('valuesFix');
      html = applyServiceCardsFix(html, key);
      __dbg_step('serviceCardsFix');
      html = applyListingStaticFix(html);
      __dbg_step('listingStaticFix');
      html = applyPortfolioFix(html);
      __dbg_step('portfolioFix');
      html = applySplitTextFix(html);
      __dbg_step('splitTextFix');
      html = applyCardTitlesFix(html);
      __dbg_step('cardTitlesFix');
      html = applyCaseMetaFix(html, key);
      __dbg_step('caseMetaFix');
      html = applyFooterAddresses(html);
      __dbg_step('footerAddresses');
      html = applyContentFlight(html, key);
      __dbg_step('contentFlight');
      // Admin asset swaps target flight payload the content fixes above rewrite,
      // so re-assert them here or hydration re-renders the original file.
      if (!noFP) html = applyAssetOverrides(html, __dbItems);
      __dbg_step('assetOverrides');
      html = applyLinks(html, req.headers.host, key);
      __dbg_step('links');
      html = applyAboutTeamRemove(html);
      __dbg_step('aboutTeamRemove');
      html = applyRevealFailsafe(html);
      __dbg_step('revealFailsafe');
      html = applyAboutTeamReplace(html, __cms);
      __dbg_step('aboutTeamReplace');
      html = applyStyleBlocks(html, await getBrand());
      __dbg_step('styleBlocks');
      html = await applyImgDims(html);
      __dbg_step('imgDims');
      html = encodeAssetSpaces(html);
      __dbg_step('encodeAssetSpaces');
      html = removeStaleProjectCards(html);
      __dbg_step('removeStaleProjectCards');
      html = applySplash(html, key);
      __dbg_step('splash');
      html = applyFooterFix(html, key);
      __dbg_step('footerFix');
      const sess = await verifySession(cookies.sc_admin).catch(() => null);
      // /insider hosts the standalone mini-CMS dashboard (own auth UI):
      // never inject the floating inline edit bar there.
      if (sess && key !== '/insider') {
        // Boot via inline script: React hydration can wipe deferred tags before
        // they run, but an inline script executes during parse, so its loader survives.
        html = html.replace(/(<\/body>)/i,
          `<script>window.__SC_PAGE__=${JSON.stringify(key)};window.__sc_boot=function(){if(window.__sc_editbar_on||!document.body)return;var s=document.createElement('script');s.src='/editbar.js';s.setAttribute('data-sc-boot','1');document.body.appendChild(s);};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',window.__sc_boot);}else{window.__sc_boot();}setTimeout(window.__sc_boot,2000);setTimeout(window.__sc_boot,5000);setTimeout(window.__sc_boot,9000);</script>\n$1`);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
      res.end(html);
      return true;
    }
    if (lookup.endsWith('.html') || path.extname(lookup) === '') {
      for (const f of resolveFile(lookup.endsWith('.html') ? lookup : lookup + '.html')) {
        try { if (await serveHtml(f)) return; } catch (e) { console.error('[serve] serveHtml failed for ' + f + ':', (e && e.message) || e); }
      }
      // directory index fallback
      for (const f of resolveFile(lookup)) {
        try { if (await serveHtml(path.join(f, 'index.html'))) return; } catch (e) { console.error('[serve] serveHtml failed for ' + f + '/index.html:', (e && e.message) || e); }
      }
    }
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    res.end('not found');
  } catch (e) {
    res.writeHead(500);
    res.end('error');
  }
});

server.listen(PORT, () => {
  console.log(`StillCraft serving dist/ at http://localhost:${PORT}`);
  // Warm caches so the first real visitor skips DB roundtrips.
  getBrand().catch(() => {});
  for (const p of ['/', '/home', '/about', '/service/events', '/service/exhibits', '/projects', '/contact']) {
    getOverrides(p).catch(() => {});
  }
});
