// Email every website enquiry (quote / contact / prize forms) to the company
// inbox. Enquiries are always saved first (api/lead.js); email is a copy, so
// a mail problem can never lose an enquiry.
//
// Free ways to send - set ONE of these in Vercel → Settings → Environment
// Variables (Production + Preview), then redeploy:
//
//  A) Gmail / Google Workspace (free; 500/day personal, 2,000/day Workspace)
//       SMTP_USER = the Gmail / Workspace address that sends
//       SMTP_PASS = a 16-character App Password (needs 2-Step Verification)
//     (SMTP_HOST defaults to smtp.gmail.com, port 465)
//  B) Brevo SMTP (free; 300/day) or any mail host (cPanel, Zoho...)
//       SMTP_HOST, SMTP_PORT (587 or 465), SMTP_USER, SMTP_PASS, SMTP_FROM
//  C) Resend API (free; 3,000/month, 100/day; domain must be verified)
//       RESEND_API_KEY, RESEND_FROM (e.g. "Website <web@stillcraftevents.co.ke>")
//
//  LEAD_EMAIL_TO = where enquiries go (comma-separated allowed).
//                  Default: info@stillcraftevents.co.ke
import './env.mjs';

const DEFAULT_TO = 'info@stillcraftevents.co.ke';

function env(name) {
  let s = String(process.env[name] == null ? '' : process.env[name]).trim();
  if (s.length > 1 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) s = s.slice(1, -1).trim();
  return s;
}

function recipients() {
  return (env('LEAD_EMAIL_TO') || DEFAULT_TO).split(',').map((s) => s.trim()).filter((s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s));
}

export function emailSettings() {
  const to = recipients();
  if (env('RESEND_API_KEY')) {
    return { provider: 'resend', to, from: env('RESEND_FROM') || null, ready: !!env('RESEND_FROM') && to.length > 0,
      problem: !env('RESEND_FROM') ? 'RESEND_FROM is not set (e.g. "Website <web@stillcraftevents.co.ke>", on your verified domain).' : null };
  }
  if (env('SMTP_USER') || env('SMTP_PASS') || env('SMTP_HOST')) {
    const host = env('SMTP_HOST') || 'smtp.gmail.com';
    const missing = ['SMTP_USER', 'SMTP_PASS'].filter((k) => !env(k));
    return { provider: host === 'smtp.gmail.com' ? 'gmail' : 'smtp', host, to, from: env('SMTP_FROM') || env('SMTP_USER') || null,
      ready: !missing.length && to.length > 0, problem: missing.length ? 'Missing ' + missing.join(' and ') + '.' : null };
  }
  return { provider: 'none', to, ready: false, problem: 'No email sender is set up yet.' };
}

const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (s, max) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 200);

const LABELS = {
  Last_Name: 'Name', Email: 'Email', Phone: 'Phone', Company: 'Company', Project_Type: 'Project type',
  Estimated_Budget: 'Estimated budget', How_Did_You_Hear_About_Us: 'How they heard about us',
  Description: 'Message', Source_Page: 'Sent from page', Submit_Form: 'Form',
};
const SKIP = new Set(['content', 'recaptchaToken', 'recaptchaAction', 'url', 'File']);

function fileLinks(payload) {
  const out = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string') { if (/^(https?:\/\/|\/)[^\s]+\.(pdf|png|jpe?g|webp)(\?|$)/i.test(v)) out.push(v); return; }
    if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(payload && payload.File);
  return out;
}

export function buildLeadEmail(lead, site) {
  let payload = {};
  try { payload = typeof lead.payload === 'string' ? JSON.parse(lead.payload) : (lead.payload || {}); } catch {}
  const kind = lead.kind === 'contact' ? 'Contact message' : lead.kind === 'prize' ? 'Prize entry' : 'Quote request';
  const who = oneLine(lead.name || payload.Last_Name || lead.email, 80);
  const subject = oneLine(`${kind} from ${who}${payload.Project_Type ? ' — ' + payload.Project_Type : ''}`, 160);
  const rows = [];
  const seen = new Set();
  const add = (label, value) => { const v = String(value == null ? '' : value).trim(); if (v) rows.push([label, v]); };
  for (const [k, label] of Object.entries(LABELS)) { seen.add(k); add(label, payload[k] ?? (k === 'Last_Name' ? lead.name : k === 'Email' ? lead.email : '')); }
  for (const [k, v] of Object.entries(payload)) {
    if (seen.has(k) || SKIP.has(k) || v == null || typeof v === 'object') continue;
    add(k.replace(/_/g, ' '), v);
  }
  const files = fileLinks(payload).map((f) => (f.startsWith('/') && site ? site.replace(/\/+$/, '') + f : f));
  files.forEach((f, i) => add(files.length > 1 ? `Attachment ${i + 1}` : 'Attachment', f));
  add('Received', new Date(Number(lead.created_at) || Date.now()).toUTCString());

  const text = `${kind} from the website\n\n` + rows.map(([l, v]) => `${l}: ${v}`).join('\n')
    + `\n\nReply to this email to answer ${who} directly.`;
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#1e1e1e">`
    + `<h2 style="margin:0 0 12px;font-size:18px">${escHtml(kind)} from the website</h2>`
    + `<table cellpadding="6" style="border-collapse:collapse">`
    + rows.map(([l, v]) => `<tr><td style="color:#666;vertical-align:top;white-space:nowrap">${escHtml(l)}</td>`
      + `<td style="white-space:pre-wrap">${/^https?:\/\//.test(v) ? `<a href="${escHtml(v)}">${escHtml(v)}</a>` : escHtml(v)}</td></tr>`).join('')
    + `</table><p style="color:#666;margin-top:16px">Reply to this email to answer ${escHtml(who)} directly.</p></div>`;
  const replyTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(lead.email || '') ? lead.email : undefined;
  return { subject, text, html, replyTo };
}

function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + ' timed out after ' + ms / 1000 + 's')), ms); })])
    .finally(() => clearTimeout(t));
}

// Plain-language reasons for the usual setup mistakes.
function explain(e) {
  const m = String((e && (e.response || e.message)) || e);
  if (/Application-specific password required|InvalidSecondFactor|534-5\.7\.9/i.test(m)) return 'Gmail needs an App Password here, not your normal password (Google Account → Security → 2-Step Verification → App passwords). ' + m;
  if (/Username and Password not accepted|535|Invalid login|authentication failed/i.test(m)) return 'The mail server rejected SMTP_USER / SMTP_PASS. Check them (for Gmail use a 16-character App Password). ' + m;
  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) return 'SMTP_HOST could not be found. ' + m;
  if (/ETIMEDOUT|ECONNREFUSED|timed out/i.test(m)) return 'Could not connect to the mail server (check SMTP_HOST and SMTP_PORT: 465 or 587). ' + m;
  if (/domain is not verified|not verified/i.test(m)) return 'Resend: verify your domain and send from an address on it (RESEND_FROM). ' + m;
  if (/Daily user sending limit exceeded|5\.4\.5/i.test(m)) return 'Daily sending limit reached; it resets within 24 hours. ' + m;
  return m;
}

// Send one message. Resolves { ok: true, id } or { ok: false, error }.
export async function sendMail({ subject, text, html, replyTo, to }) {
  const s = emailSettings();
  if (!s.ready) return { ok: false, skipped: true, error: s.problem || 'email not configured' };
  const rcpt = to || s.to;
  try {
    if (s.provider === 'resend') {
      const res = await withTimeout(fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: s.from, to: rcpt, subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      }), 9000, 'Resend');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d && (d.message || d.error)) || ('Resend error ' + res.status));
      return { ok: true, id: d.id || null };
    }
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(env('SMTP_PORT') || 465);
    const transport = nodemailer.createTransport({
      host: s.host, port, secure: port === 465,
      auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS').replace(/\s+/g, '') }, // app passwords are often pasted with spaces
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 9000,
    });
    const from = /</.test(s.from) ? s.from : `"StillCraft website" <${s.from}>`;
    const info = await withTimeout(transport.sendMail({ from, to: rcpt.join(', '), subject, text, html, ...(replyTo ? { replyTo } : {}) }), 10000, 'SMTP');
    return { ok: true, id: info.messageId || null };
  } catch (e) {
    return { ok: false, error: explain(e).slice(0, 400) };
  }
}

export async function sendLeadEmail(lead, site) {
  return sendMail(buildLeadEmail(lead, site));
}
