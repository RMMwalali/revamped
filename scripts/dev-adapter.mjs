// Runs the Vercel-style handlers in api/*.js on a plain Node http server, so
// local dev and any self-hosted run execute exactly the code Vercel does.
// Mirrors the two conveniences Vercel adds to (req, res): response helpers
// (res.status().json()/send()) and a parsed req.body - skipped when a handler
// opts out with `export const config = { api: { bodyParser: false } }`.
import { URL } from 'node:url';

const BODY_LIMIT = 4.5 * 1024 * 1024; // Vercel's own cap on parsed bodies

export function decorateRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) return res.json(body);
    if (typeof body === 'string' && !res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(body);
    return res;
  };
  return res;
}

async function readRaw(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) { const e = new Error('too large'); e.code = 'TOO_LARGE'; throw e; }
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export async function runHandler(mod, req, res) {
  decorateRes(res);
  try {
    const u = new URL(req.url, 'http://local');
    req.query = Object.fromEntries(u.searchParams);
    const raw = mod.config && mod.config.api && mod.config.api.bodyParser === false;
    if (!raw && req.method !== 'GET' && req.method !== 'HEAD') {
      let buf;
      try { buf = await readRaw(req, BODY_LIMIT); }
      catch { res.status(413).json({ error: 'request body too large' }); return; }
      const type = String(req.headers['content-type'] || '');
      if (type.includes('application/json')) {
        try { req.body = buf.length ? JSON.parse(buf.toString('utf8')) : {}; }
        catch { res.status(400).json({ error: 'bad request' }); return; }
      } else if (type.includes('application/x-www-form-urlencoded')) {
        req.body = Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
      } else if (type.startsWith('text/')) {
        req.body = buf.toString('utf8');
      } else {
        req.body = buf;
      }
    }
    await mod.default(req, res);
  } catch (e) {
    console.error('[dev] handler crashed:', (e && e.stack) || e);
    if (!res.headersSent) res.status(500).json({ error: 'internal error' });
    else res.end();
  }
}
