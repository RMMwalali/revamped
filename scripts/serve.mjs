// StillCraft Events - local / self-hosted server.
//
// This is deliberately thin. It serves static files from dist/ and hands
// everything dynamic to the SAME handlers Vercel runs (api/*.js), through
// scripts/dev-adapter.mjs. It used to carry its own copy of every route and of
// the whole page-rendering pipeline; those copies drifted from production
// again and again (login limits, upload handling, testimonials, team), so
// "works locally" stopped meaning "works on Vercel". Do not re-add routes here:
// add or change them in api/ and they apply everywhere.
import './env.mjs';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { runHandler } from './dev-adapter.mjs';

const ROOT = path.resolve('dist');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.pdf': 'application/pdf',
};

// Handler modules are loaded once, on first use.
const handlers = new Map();
async function handlerFor(name) {
  if (!handlers.has(name)) handlers.set(name, import('../api/' + name + '.js'));
  return handlers.get(name);
}
const API_NAMES = new Set(['login', 'logout', 'me', 'content', 'cms', 'brand', 'upload', 'lead', 'leads', 'img', 'page', 'storage', 'email']);

function safeFile(urlPath) {
  let p = urlPath.split('?')[0];
  try { p = decodeURIComponent(p); } catch {}
  const full = path.normalize(path.join(ROOT, p));
  return full.startsWith(ROOT) ? full : null;
}

async function sendStatic(res, file) {
  try {
    const st = await stat(file);
    if (!st.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://local');
    const pathname = u.pathname;

    // /api/<name> -> api/<name>.js
    if (pathname.startsWith('/api/')) {
      const name = pathname.slice(5).replace(/\/+$/, '');
      if (!API_NAMES.has(name)) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"not found"}'); return; }
      await runHandler(await handlerFor(name), req, res);
      return;
    }
    // vercel.json rewrites these to the page function (generated SEO files)
    if (pathname === '/sitemap.xml' || pathname === '/robots.txt') { await runHandler(await handlerFor('page'), req, res); return; }
    // vercel.json rewrites this to the image function
    if (pathname === '/_next/image') { await runHandler(await handlerFor('img'), req, res); return; }

    // Static files. HTML never goes through here: pages are rendered by the
    // page handler (brand, overrides, CMS, admin bar). /insider is plain static
    // on Vercel (no rewrite), so it is here too.
    const lookup = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const file = safeFile(lookup);
    if (file && (!/\.html?$/i.test(file) || pathname === '/insider' || pathname.startsWith('/insider/'))) {
      if (await sendStatic(res, file)) return;
      if (pathname === '/insider' || pathname === '/insider/') {
        if (await sendStatic(res, path.join(ROOT, 'insider', 'index.html'))) return;
      }
    }

    // Everything else that is a page route: the production page handler.
    if (path.extname(pathname) === '' || /\.html?$/i.test(pathname)) {
      await runHandler(await handlerFor('page'), req, res);
      return;
    }
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    res.end('not found');
  } catch (e) {
    console.error('[serve] unhandled:', (e && e.stack) || e);
    if (!res.headersSent) res.writeHead(500);
    res.end('error');
  }
});

server.listen(PORT, () => {
  console.log(`StillCraft serving dist/ at http://localhost:${PORT} (api/ handlers, same as Vercel)`);
});
