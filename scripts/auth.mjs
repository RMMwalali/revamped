// Session + admin auth helpers (cookie-based, Postgres-backed).
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.mjs';

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

export async function verifySession(token) {
  if (!token) return null;
  const r = await pool.query(
    'SELECT s.admin_id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token = $1 AND s.expires_at > now()',
    [token]
  );
  return r.rows[0] || null;
}

export async function login(email, password) {
  const r = await pool.query('SELECT id, email, password_hash FROM admins WHERE email = $1', [email.toLowerCase()]);
  const admin = r.rows[0];
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return null;
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
  await pool.query('INSERT INTO sessions (token, admin_id, expires_at) VALUES ($1, $2, $3)', [token, admin.id, expires.toISOString()]);
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  return { token, email: admin.email, expires };
}

export async function logout(token) {
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

export function sessionCookie(token, expires) {
  const maxAge = Math.max(1, Math.floor((expires.getTime() - Date.now()) / 1000));
  return `sc_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearCookie() {
  return 'sc_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}
