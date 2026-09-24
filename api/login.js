// POST /api/login { email, password } — env-var auth, in-memory rate limiting.
import { login, sessionCookie } from '../scripts/auth.mjs';

const LOCK_MINUTES = 5;
const MAX_FAILS = 5;
const attempts = new Map();

function isLimited(ip) {
  const a = attempts.get(ip);
  return !!(a && a.lockedUntil > Date.now());
}

function recordFailure(ip) {
  const a = attempts.get(ip) || { fails: 0, lockedUntil: 0 };
  a.fails++;
  if (a.fails >= MAX_FAILS) {
    a.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    a.fails = 0;
  }
  attempts.set(ip, a);
}

function clearFailures(ip) {
  attempts.delete(ip);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x';
  if (isLimited(ip)) { res.status(429).json({ error: 'too many attempts, try later' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  let sess = null;
  try {
    sess = await login(String(body.email || ''), String(body.password || ''));
  } catch (err) {
    console.error('[login] auth error:', err.code || err.message);
    sess = null;
  }
  if (!sess) { recordFailure(ip); res.status(401).json({ error: 'invalid credentials' }); return; }
  clearFailures(ip);
  res.setHeader('Set-Cookie', sessionCookie(sess.token, sess.expires));
  res.status(200).json({ email: sess.email });
}
