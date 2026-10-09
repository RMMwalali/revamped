// Session + admin auth helpers (env-var backed, signed-token sessions).
// No database required: admin credentials come from VERCEL_ENV vars,
// and sessions are HMAC-signed tokens stored in a cookie.
import './env.mjs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// Env values pasted into the Vercel dashboard often carry wrapping quotes,
// spaces or a trailing newline, and each of those makes a correct password
// fail with no clue why. Normalise them before use.
function cleanEnv(v) {
  let s = String(v == null ? '' : v).trim();
  if (s.length > 1 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\\\$/g, '$'); // "\$2b\$12\$..." escaped for a shell
}
const ADMIN_EMAIL = cleanEnv(process.env.ADMIN_EMAIL).toLowerCase();
const ADMIN_PASSWORD_HASH = cleanEnv(process.env.ADMIN_PASSWORD);
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
// A random per-process secret is the wrong fallback here: on Vercel every
// instance and every cold start would sign with a different key, so a token
// minted by one request fails verification on the next and the admin is
// bounced straight back to the login screen. Derive a stable key from the
// configured credentials instead, so sessions survive restarts and scale-out
// even when APP_SECRET is unset. Changing the admin password rotates it,
// which is the behaviour you want anyway.
const APP_SECRET = cleanEnv(process.env.APP_SECRET)
  || (ADMIN_PASSWORD_HASH
        ? crypto.createHash('sha256')
            .update('sc-session:' + ADMIN_EMAIL + ':' + ADMIN_PASSWORD_HASH)
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

// True when this deployment has admin credentials and a signing key. Lets the
// login endpoint tell "not set up here" apart from "wrong password".
export function isConfigured() {
  return configProblem() === null;
}

// Plain-language description of what is wrong with the admin env vars, or
// null when they are usable. Describes the shape of a value only, never the
// value itself, so it is safe to send to the login page.
export function configProblem() {
  if (!ADMIN_EMAIL) return 'ADMIN_EMAIL is not set on this server.';
  if (!ADMIN_EMAIL.includes('@')) return 'ADMIN_EMAIL is set but is not an email address.';
  if (!ADMIN_PASSWORD_HASH) return 'ADMIN_PASSWORD is not set on this server.';
  if (!BCRYPT_RE.test(ADMIN_PASSWORD_HASH)) {
    if (!ADMIN_PASSWORD_HASH.startsWith('$2')) {
      return 'ADMIN_PASSWORD looks like a plain password. It must be a bcrypt hash (starts with $2b$12$). Generate one with: npm run hash-password';
    }
    return 'ADMIN_PASSWORD starts like a bcrypt hash but is ' + ADMIN_PASSWORD_HASH.length +
      ' characters long instead of 60, so it was cut off or altered when pasted. Generate a fresh one with: npm run hash-password';
  }
  return null;
}

export async function verifySession(token) {
  return verifyToken(token);
}

export async function login(email, password) {
  if (!APP_SECRET) {
    console.error('[login] no signing key: set APP_SECRET (or ADMIN_PASSWORD)');
    return null;
  }
  const problem = configProblem();
  if (problem) {
    console.error('[login] admin not configured:', problem);
    return null;
  }
  if (String(email).trim().toLowerCase() !== ADMIN_EMAIL) {
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
