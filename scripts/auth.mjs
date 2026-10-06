// Session + admin auth helpers (env-var backed, signed-token sessions).
// No database required: admin credentials come from VERCEL_ENV vars,
// and sessions are HMAC-signed tokens stored in a cookie.
import './env.mjs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD || '';
// A random per-process secret is the wrong fallback here: on Vercel every
// instance and every cold start would sign with a different key, so a token
// minted by one request fails verification on the next and the admin is
// bounced straight back to the login screen. Derive a stable key from the
// configured credentials instead, so sessions survive restarts and scale-out
// even when APP_SECRET is unset. Changing the admin password rotates it,
// which is the behaviour you want anyway.
const APP_SECRET = process.env.APP_SECRET
  || (process.env.ADMIN_PASSWORD
        ? crypto.createHash('sha256')
            .update('sc-session:' + (process.env.ADMIN_EMAIL || '') + ':' + process.env.ADMIN_PASSWORD)
            .digest('hex')
        : null);
if (!process.env.APP_SECRET && APP_SECRET) {
  console.warn('[auth] APP_SECRET is not set; deriving the session key from ADMIN_PASSWORD. Set APP_SECRET to control session lifetime independently.');
}
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 72);

export function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function signToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + TTL_HOURS * 3600 * 1000,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', APP_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyToken(token) {
  if (!token || !APP_SECRET) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', APP_SECRET).update(payload).digest('base64url');
  // Constant-time compare. A plain !== bails on the first differing byte, so
  // response timing reveals how much of a forged signature was correct —
  // enough, given enough samples, to recover the rest and forge a session.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!decoded.exp || decoded.exp < Date.now()) return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

export async function verifySession(token) {
  return verifyToken(token);
}

export async function login(email, password) {
  if (!APP_SECRET) {
    console.error('[login] no signing key: set APP_SECRET (or ADMIN_PASSWORD)');
    return null;
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
    console.error('[login] admin not configured (set ADMIN_EMAIL and ADMIN_PASSWORD)');
    return null;
  }
  if (email.toLowerCase() !== ADMIN_EMAIL) {
    // No address in the log line: these land in platform logs, and writing
    // the admin's own address (or a probe's guess) there tells anyone with
    // log access which account is worth attacking.
    console.error('[login] rejected: unknown account');
    return null;
  }
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) {
    console.error('[login] rejected: password mismatch');
    return null;
  }
  const token = signToken(email);
  const expires = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
  return { token, email: ADMIN_EMAIL, expires };
}

export async function logout(token) {
  // Stateless signed tokens: logout is handled by cookie expiration.
}

// Secure is only added on Vercel (real HTTPS) — plain `http://localhost` dev
// would silently drop the cookie on some browsers if it were always set.
const SECURE = process.env.VERCEL ? ' Secure;' : '';

export function sessionCookie(token, expires) {
  const maxAge = Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1000));
  return `sc_admin=${token}; HttpOnly;${SECURE} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearCookie() {
  return `sc_admin=; HttpOnly;${SECURE} SameSite=Lax; Path=/; Max-Age=0`;
}
// Force redeploy
