// POST /api/logout
import { parseCookies, logout, clearCookie } from '../scripts/auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).send('method not allowed'); return; }
  try { await logout(parseCookies(req).sc_admin); } catch {}
  res.setHeader('Set-Cookie', clearCookie());
  res.status(200).json({ ok: true });
}
