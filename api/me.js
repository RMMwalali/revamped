// GET /api/me
import { parseCookies, verifySession } from '../scripts/auth.mjs';

export default async function handler(req, res) {
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  res.status(200).json({ email: s.email });
}
