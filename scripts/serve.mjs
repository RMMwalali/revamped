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
import { pool } from './db.mjs';
import { parseCookies, verifySession, login, logout, sessionCookie, clearCookie } from './auth.mjs';
import { getOverrides, applyOverrides, bustOverrides, maskT } from './overrides.mjs';import {
  getBrand, bustBrand, applyBrand, applyNav, applyTheme, stripThirdParty,
  parseUpload, sniffMedia, applyGlobalSwaps, applyFooterAddresses, applyHeroVideo,
  applyContentFlight, applyLinks, applyImgDims, encodeAssetSpaces, applySplash, applyStyleBlocks,
  applyFooterFix, applyTeamRoster, FILE_CONTENT, LOGO_ROWS, LOGO_NAMES, HERO_VIDEO_URL,
  HERO_VIDEO_MOBILE_URL, HERO_POSTER_URL, mobileFor, posterFor,
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

// login rate limit: ip -> { fails, until }
const rl = new Map();
function rateLimited(ip) {
  const e = rl.get(ip);
  return e && e.until > Date.now();
}
function rateFail(ip) {
  const e = rl.get(ip) || { fails: 0, until: 0 };
  e.fails += 1;
  if (e.fails >= 5) { e.until = Date.now() + 5 * 60 * 1000; e.fails = 0; }
  rl.set(ip, e);
}


const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://local');
    let pathname = u.pathname;
    const method = req.method;
    const cookies = parseCookies(req);

    // ----- API -----
    if (pathname === '/api/login' && method === 'POST') {
      const ip = req.socket.remoteAddress || 'x';
      if (rateLimited(ip)) return json(res, 429, { error: 'too many attempts, try later' });
      let body;
      try { body = JSON.parse((await readBody(req)).toString('utf8')); }
      catch { return json(res, 400, { error: 'bad request' }); }
      const sess = await login(String(body.email || ''), String(body.password || '')).catch(() => null);
      if (!sess) { rateFail(ip); return json(res, 401, { error: 'invalid credentials' }); }
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
      const r = await pool.query('SELECT el_id, kind, value, orig_html, idx, tag FROM content_overrides WHERE page = $1', [page]).catch(() => null);
      return json(res, 200, { page, items: r ? r.rows : [] });
    }
    if (pathname === '/api/content' && method === 'PUT') {
      const s = await verifySession(cookies.sc_admin).catch(() => null);
      if (!s) return json(res, 401, { error: 'unauthorized' });
      let body;
      try { body = JSON.parse((await readBody(req, 5 << 20)).toString('utf8')); }
      catch { return json(res, 400, { error: 'bad request' }); }
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
      bustCMS();
      return json(res, 200, { ok: true, saved: items.length });
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
      bustCMS();
      return json(res, 200, await getBrand());
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
    // category pages have no static equivalent: serve /projects
    if (pathname === '/projects/mall-activations' || pathname.startsWith('/projects/mall-activations/')) {
      pathname = '/projects';
    }

    // ----- Next.js image optimizer shim (serve bytes directly: no redirect roundtrip) -----
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
      for (const f of resolveFile(target)) {
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
      if (!process.env.SC_NOSTRIP) html = stripThirdParty(html);
      html = applyBrand(html, await getBrand());
      if (!process.env.SC_NONAV) html = applyNav(html, key);
      // Legal pages have no below-root error boundary: a flight patch that the
      // client parses as a truncated stream fatals the whole page, so serve
      // them static-only (a 418 revert beats an Application error).
      const noFP = key === '/cookie-policy' || key === '/privacy-policy' || key === '/legal-notice-terms-of-use';
      html = applyOverrides(html, await getOverrides(key), { noFlightPatch: noFP });
      const fileItems = [...(FILE_CONTENT[key] || []),
        ...((LOGO_ROWS[key] || []).filter(r => !/Testimonial/i.test(r.orig_html))),
        ...((LOGO_NAMES[key] || []).map(n => ({ el_id: n.id, kind: 'text', value: n.name, orig_html: n.old })))];
      if (fileItems.length) html = applyOverrides(html, fileItems, { noFlightPatch: noFP });
      html = applyGlobalSwaps(html, key);
      const __brand = await getBrand();
      const __cms = await getCMS().catch(() => null);
      const __heroUrl = (__cms && __cms.hero && __cms.hero.video_url) || __brand.hero_video_src || HERO_VIDEO_URL;
      const __heroMob = (__cms && __cms.hero && __cms.hero.video_mobile_url) || mobileFor(__heroUrl) || HERO_VIDEO_MOBILE_URL;
      const __heroPos = posterFor(__heroUrl) || HERO_POSTER_URL;
      html = applyHeroVideo(html, __heroUrl, __heroMob, __heroPos);
      if (__cms) html = await applyStructuredCMS(html, __cms, key);
      html = applyFooterAddresses(html);
      html = applyContentFlight(html, key);
      html = applyLinks(html, req.headers.host, key);
      html = applyTeamRoster(html);
      html = applyStyleBlocks(html, await getBrand());
      html = await applyImgDims(html);
      html = encodeAssetSpaces(html);
      html = applySplash(html, key);
      html = applyFooterFix(html, key);
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
        try { if (await serveHtml(f)) return; } catch {}
      }
      // directory index fallback
      for (const f of resolveFile(lookup)) {
        try { if (await serveHtml(path.join(f, 'index.html'))) return; } catch {}
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
  for (const p of ['/', '/home', '/about', '/service/events', '/service/exhibits', '/insights', '/projects', '/contact']) {
    getOverrides(p).catch(() => {});
  }
});
