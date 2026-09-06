// POST /api/login { email, password } â€” per-instance rate limiting only.
import { login, sessionCookie } from '../scripts/auth.mjs';

const rl = new Map();
function limited(ip) {
  const e = rl.get(ip);
  return e && e.until > Date.now();
}
function fail(ip) {
  const e = rl.get(ip) || { fails: 0, until: 0 };
  e.fails += 1;
  if (e.fails >= 5) { e.until = Date.now() + 5 * 60 * 1000; e.fails = 0; }
  rl.set(ip, e);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x';
  if (limited(ip)) { res.status(429).json({ error: 'too many attempts, try later' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  let sess = null;
  try {
    sess = await login(String(body.email || ''), String(body.password || ''));
  } catch { sess = null; }
  if (!sess) { fail(ip); res.status(401).json({ error: 'invalid credentials' }); return; }
  res.setHeader('Set-Cookie', sessionCookie(sess.token, sess.expires));
  res.status(200).json({ email: sess.email });
}
