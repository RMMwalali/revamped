// Session + admin auth helpers (env-var backed, signed-token sessions).
// No database required: admin credentials come from VERCEL_ENV vars,
// and sessions are HMAC-signed tokens stored in a cookie.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD || '';
const APP_SECRET = process.env.APP_SECRET || crypto.randomBytes(32).toString('hex');
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
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', APP_SECRET).update(payload).digest('base64url');
  if (sig !== expected) return null;
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
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
    console.error('[login] admin not configured (set ADMIN_EMAIL and ADMIN_PASSWORD)');
    return null;
  }
  if (email.toLowerCase() !== ADMIN_EMAIL) {
    console.error('[login] no admin configured for email:', email.toLowerCase());
    return null;
  }
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) {
    console.error('[login] password mismatch for email:', email.toLowerCase());
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
