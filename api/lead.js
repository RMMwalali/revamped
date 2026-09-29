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
  // Count only submissions from the last WINDOW_MS. The age has to be compared
  // against +WINDOW_MS: the previous `> -WINDOW_MS` was true for every lead
  // ever stored, so the cap behaved as a lifetime total and a legitimate
  // visitor was locked out permanently once they had sent 5 enquiries.
  const recent = leads.filter((l) => l.ip === ip && now - l.created_at < WINDOW_MS);
  if (recent.length >= MAX_PER_IP) return { ok: false, error: 'too many submissions, try later' };

  const payload = { ...body };
  delete payload.recaptchaToken;
  delete payload.recaptchaAction;

  // `content` is the forms' hidden honeypot (a zero-size input no visitor can
  // see), so anything in it came from a bot. It was previously a fallback for
  // the message, which both filed spam as genuine enquiries and let a bot
  // choose what the enquiry said. Drop the submission instead, and still
  // answer 200 so the bot gets no signal that it was caught.
  if (str(body.content, 200).trim()) return { ok: true, dropped: 'honeypot' };

  const lead = {
    id: leads.length ? Math.max(...leads.map((l) => l.id)) + 1 : 1,
    kind: leadKind(body),
    // The forms have one "Full name*" input that posts as `Last_Name` — a
    // legacy wire name from the donor's CRM, kept because the client chunks
    // are built assets we do not rebuild. There is no separate first-name
    // field, so this already holds the complete name. Do not "fix" it into a
    // surname-only read without also changing the client payload.
    name: str(body.Last_Name, 200).trim(),
    email,
    phone: str(body.Phone, 60).trim(),
    company: str(body.Company, 200).trim(),
    // `content` is deliberately NOT a fallback here: it is the honeypot.
    message: str(body.Description, 5000).trim(),
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

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const type = String(req.headers['content-type'] || '');
  if (type.includes('multipart/form-data')) { res.status(200).json({ ok: true }); return; }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const r = await saveLead(body, clientIp(req));
    if (!r.ok) { res.status(400).json({ error: r.error }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('lead insert failed:', String((e && e.code) || 'unknown'));
    res.status(500).json({ error: 'could not save' });
  }
}
