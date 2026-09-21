// GET /api/leads (admin) — inquiries captured by api/lead.js.
// ?limit=n (default 100, max 500), ?kind=quote|contact|prize, ?format=csv.
// Without this the leads would only exist in a table nobody opens.
import { pool } from '../scripts/db.mjs';
import { parseCookies, verifySession } from '../scripts/auth.mjs';

const KINDS = ['quote', 'contact', 'prize'];

function csv(rows) {
  const cols = ['id', 'created_at', 'kind', 'name', 'email', 'phone', 'company', 'message', 'source_page'];
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'method not allowed' }); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }

  const u = new URL(req.url, 'http://local');
  const limit = Math.min(500, Math.max(1, parseInt(u.searchParams.get('limit') || '100', 10) || 100));
  const kind = String(u.searchParams.get('kind') || '');

  const where = KINDS.includes(kind) ? 'WHERE kind = $2' : '';
  const args = KINDS.includes(kind) ? [limit, kind] : [limit];
  const r = await pool.query(
    `SELECT id, created_at, kind, name, email, phone, company, message, source_page, handled
     FROM leads ${where} ORDER BY created_at DESC LIMIT $1`,
    args
  );

  res.setHeader('Cache-Control', 'no-store');
  if (u.searchParams.get('format') === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.status(200).send(csv(r.rows));
    return;
  }
  res.status(200).json({ leads: r.rows });
}
