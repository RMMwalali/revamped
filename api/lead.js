// POST /api/lead — quote, contact and prize form submissions.
// Both legs now post to /api/lead (see dist/_next/static/chunks).
import { readStore, writeStore } from '../scripts/storage.mjs';

const MAX_PER_IP = 5;
const WINDOW_MS = 10 * 60 * 1000;

function leadKind(body) {
  const f = String(body.Submit_Form || '').toLowerCase();
  if (f === 'contact') return 'contact';
  if (f === 'prize') return 'prize';
  return 'quote';
}

function str(v, max) {
  if (v == null) return '';
  return String(v).slice(0, max);
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  return (fwd.split(',')[0] || req.socket?.remoteAddress || '').trim().slice(0, 64);
}

export async function saveLead(body, ip) {
  const email = str(body.Email, 320).trim();
  if (!email || !email.includes('@')) return { ok: false, error: 'email required' };

  const leads = await readStore('leads.json') || [];
  const now = Date.now();
  const recent = leads.filter((l) => l && l.ip === ip && Number.isFinite(Number(l.created_at)) && now - Number(l.created_at) < WINDOW_MS);
  if (recent.length >= MAX_PER_IP) return { ok: false, error: 'too many submissions, try later' };

  // Dual-fetch dedupe: quote form posts FormData + JSON within ms of each
  // other. If the same email+ip saved within the last minute, treat the
  // second leg as an ack instead of inserting a duplicate row.
  const dupe = leads.some((l) => l && l.ip === ip &&
    String(l.email || '').toLowerCase() === email.toLowerCase() &&
    Number.isFinite(Number(l.created_at)) && now - Number(l.created_at) < 60 * 1000);
  if (dupe) return { ok: true, deduped: true };

  const payload = { ...body };
  delete payload.recaptchaToken;
  delete payload.recaptchaAction;

  const lead = {
    id: leads.length ? Math.max(0, ...leads.map((l) => Number(l && l.id) || 0)) + 1 : 1,
    kind: leadKind(body),
    name: str(body.Last_Name, 200).trim(),
    email,
    phone: str(body.Phone, 60).trim(),
    company: str(body.Company, 200).trim(),
    message: str(body.Description || body.content, 5000).trim(),
    payload: JSON.stringify(payload),
    source_page: str(body.Source_Page, 300),
    ip,
    handled: false,
    created_at: now,
  };
  leads.push(lead);
  await writeStore('leads.json', leads);
  return { ok: true };
}

// Minimal multipart/form-data text-field parser (for the quote-form
// FormData leg). File binaries are ignored here — attachments go through
// /api/upload separately. Returns {field: value} with values capped.
export function parseMultipartFields(buf, contentType) {
  const m = /boundary=(.+)$/.exec(String(contentType || ''));
  if (!m || !buf || !buf.length) return null;
  const boundary = '--' + m[1].trim().replace(/^"|"$/g, '');
  const raw = buf.toString('latin1');
  const fields = {};
  let pos = 0;
  let guard = 0;
  while (guard++ < 200) {
    const bStart = raw.indexOf(boundary, pos);
    if (bStart < 0) break;
    const hEnd = raw.indexOf('\r\n\r\n', bStart);
    if (hEnd < 0) break;
    const head = raw.slice(bStart, hEnd);
    const nameM = /name="([^"]+)"/.exec(head);
    const fileM = /filename="([^"]*)"/.exec(head);
    let vEnd = raw.indexOf(boundary, hEnd + 4);
    if (vEnd < 0) vEnd = raw.length;
    let value = raw.slice(hEnd + 4, vEnd);
    if (value.endsWith('\r\n')) value = value.slice(0, -2);
    if (nameM && !fileM) fields[nameM[1]] = value.slice(0, 10000);
    pos = vEnd;
    // Closing delimiter is `--boundary--`: check for trailing `--` AFTER
    // the boundary token (every delimiter starts with `--`, so checking
    // the first 2 chars breaks after the first field).
    if (raw.slice(vEnd + boundary.length, vEnd + boundary.length + 2) === '--') break;
    if (vEnd >= raw.length) break;
  }
  return fields;
}

function normalizeBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') {
    try { const p = JSON.parse(body); if (p && typeof p === 'object') return p; } catch {}
    return {};
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const type = String(req.headers['content-type'] || '');
  if (type.includes('multipart/form-data')) {
    // Dual-fetch compat: the quote form posts FormData + JSON together and
    // requires both legs to 200. The JSON leg is canonical; this leg saves
    // too so single-leg FormData posts are not silently dropped, with
    // same-email+ip dedupe in saveLead() preventing double rows.
    try {
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', (c) => chunks.push(c));
        req.on('end', resolve);
        req.on('error', reject);
      });
      const fields = parseMultipartFields(Buffer.concat(chunks), req.headers['content-type']);
      if (fields && (fields.Email || fields.email)) {
        const body = { ...fields };
        if (fields.email && !body.Email) body.Email = fields.email;
        const r = await saveLead(body, clientIp(req));
        if (!r.ok) { res.status(400).json({ error: r.error }); return; }
      }
      res.status(200).json({ ok: true });
    } catch {
      res.status(200).json({ ok: true });
    }
    return;
  }

  const body = normalizeBody(req.body);
  try {
    const r = await saveLead(body, clientIp(req));
    if (!r.ok) { res.status(400).json({ error: r.error }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('lead insert failed:', String((e && e.code) || 'unknown'));
    res.status(500).json({ error: 'could not save' });
  }
}
