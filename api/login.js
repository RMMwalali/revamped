// POST /api/login { email, password } — DB-backed rate limiting.
// Vercel runs this behind several serverless instances, so an in-memory
// counter resets per instance and barely slows a real attempt spread across
// a few concurrent connections. login_attempts (scripts/schema.mjs) is
// shared across every instance and region instead.
import { login, sessionCookie } from '../scripts/auth.mjs';
import { pool } from '../scripts/db.mjs';

const LOCK_MINUTES = 5;
const MAX_FAILS = 5;

async function isLimited(ip) {
  try {
    const r = await pool.query('SELECT locked_until FROM login_attempts WHERE ip = $1', [ip]);
    const row = r.rows[0];
    return !!(row && row.locked_until && new Date(row.locked_until) > new Date());
  } catch (err) {
    console.error('isLimited DB error:', err.message);
    return false; // table not migrated yet, or DB unreachable: fail open rather than lock everyone out
  }
}

async function recordFailure(ip) {
  try {
    const r = await pool.query('SELECT fails FROM login_attempts WHERE ip = $1', [ip]);
    const fails = (r.rows[0]?.fails || 0) + 1;
    if (fails >= MAX_FAILS) {
      const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      await pool.query(
        `INSERT INTO login_attempts (ip, fails, locked_until, updated_at) VALUES ($1, 0, $2, now())
         ON CONFLICT (ip) DO UPDATE SET fails = 0, locked_until = $2, updated_at = now()`,
        [ip, lockedUntil]
      );
    } else {
      await pool.query(
        `INSERT INTO login_attempts (ip, fails, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (ip) DO UPDATE SET fails = $2, updated_at = now()`,
        [ip, fails]
      );
    }
  } catch (err) {
    console.error('recordFailure DB error:', err.message);
  }
}

async function clearFailures(ip) {
  try { await pool.query('DELETE FROM login_attempts WHERE ip = $1', [ip]); } catch (err) {
    console.error('clearFailures DB error:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x';
  if (await isLimited(ip)) { res.status(429).json({ error: 'too many attempts, try later' }); return; }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  let sess = null;
    try {
      sess = await login(String(body.email || ''), String(body.password || ''));
    } catch (err) {
      console.error('login() threw:', err.message);
      sess = null;
    }
  if (!sess) { await recordFailure(ip); res.status(401).json({ error: 'invalid credentials' }); return; }
  await clearFailures(ip);
  res.setHeader('Set-Cookie', sessionCookie(sess.token, sess.expires));
  res.status(200).json({ email: sess.email });
}
