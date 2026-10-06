// GET /api/leads (admin) — inquiries captured by api/lead.js.
// ?limit=n (default 100, max 500), ?kind=quote|contact|prize, ?format=csv.
import { readStore } from '../scripts/storage.mjs';
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

  const leads = await readStore('leads.json') || [];
  let rows = leads;
  if (KINDS.includes(kind)) rows = rows.filter((l) => l.kind === kind);
  rows = rows.slice().sort((a, b) => b.created_at - a.created_at).slice(0, limit);
  // Convert created_at from ms to ISO string for consistency with old API.
  // Guard: a single corrupt row must not 500 the whole export.
  rows = rows.map((r) => {
    let iso = '';
    try { const d = new Date(Number(r.created_at)); iso = Number.isNaN(d.getTime()) ? String(r.created_at ?? '') : d.toISOString(); }
    catch { iso = String(r.created_at ?? ''); }
    return { ...r, created_at: iso };
  });

  res.setHeader('Cache-Control', 'no-store');
  if (u.searchParams.get('format') === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.status(200).send(csv(rows));
    return;
  }
  res.status(200).json({ leads: rows });
}
