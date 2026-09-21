// POST /api/lead — quote, contact and prize form submissions.
//
// The cloned bundle fired two parallel requests per submit: a multipart
// "notify the admin" leg at /api/ajax, and a JSON leg at
// https://iventions.com/api/zoho — the donor agency's CRM relay. Both are now
// pointed here (see dist/_next/static/chunks: the fetch pairs in 8809, 7172
// and the contact page chunk), so inquiries land in our own database instead
// of a competitor's Zoho.
//
// The form only shows the visitor a success message when BOTH legs return ok,
// so the multipart leg has to answer 200 as well. The JSON leg carries the
// same fields and is the one we record.
import { pool } from '../scripts/db.mjs';

const MAX_PER_IP = 5; // per window, below
const WINDOW_MINUTES = 10;

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  return (fwd.split(',')[0] || req.socket?.remoteAddress || '').trim().slice(0, 64);
}

// Submit_Form is set by each form: "Contact", "Prize", or absent on the quote
// form. Anything unrecognised is recorded as a quote rather than dropped.
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

async function overLimit(ip) {
  if (!ip) return false;
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM leads
       WHERE ip = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
      [ip, String(WINDOW_MINUTES)]
    );
    return (r.rows[0]?.n || 0) >= MAX_PER_IP;
  } catch {
    return false; // table not migrated yet, or DB unreachable: take the lead
  }
}

export async function saveLead(body, ip) {
  const email = str(body.Email, 320).trim();
  if (!email || !email.includes('@')) return { ok: false, error: 'email required' };
  if (await overLimit(ip)) return { ok: false, error: 'too many submissions, try later' };

  // Keep every field the form sent, minus the reCAPTCHA tokens, which are
  // single-use credentials and have no value once the request is handled.
  const payload = { ...body };
  delete payload.recaptchaToken;
  delete payload.recaptchaAction;

  await pool.query(
    `INSERT INTO leads (kind, name, email, phone, company, message, payload, source_page, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      leadKind(body),
      str(body.Last_Name, 200).trim(),
      email,
      str(body.Phone, 60).trim(),
      str(body.Company, 200).trim(),
      str(body.Description || body.content, 5000).trim(),
      JSON.stringify(payload),
      str(body.Source_Page, 300),
      ip,
    ]
  );
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  // The multipart leg duplicates the JSON leg's fields; acknowledge it so the
  // visitor sees success, and let the JSON leg do the recording.
  const type = String(req.headers['content-type'] || '');
  if (type.includes('multipart/form-data')) { res.status(200).json({ ok: true }); return; }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const r = await saveLead(body, clientIp(req));
    if (!r.ok) { res.status(400).json({ error: r.error }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    // Never echo the submission back into logs — it is customer PII.
    console.error('lead insert failed:', String((e && e.code) || 'unknown'));
    res.status(500).json({ error: 'could not save' });
  }
}
