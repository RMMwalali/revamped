// Served at /api/email by the api/storage.js function (Vercel's free plan
// allows 12 functions per deployment, so this does not get its own file).
// GET /api/email (admin): is enquiry email set up, and where does it go?
// POST /api/email (admin): send a test enquiry email to the company inbox.
import { parseCookies, verifySession } from './auth.mjs';
import { emailSettings, sendMail, buildLeadEmail } from './notify.mjs';

export async function emailHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  const s = await verifySession(parseCookies(req).sc_admin).catch(() => null);
  if (!s) { res.status(401).json({ error: 'unauthorized' }); return; }
  const st = emailSettings();
  const info = { provider: st.provider, to: st.to, from: st.from || null, ready: st.ready, problem: st.problem || null };
  if (req.method === 'GET') { res.status(200).json(info); return; }
  const msg = buildLeadEmail({
    kind: 'quote', name: 'Website test', email: s.email, created_at: Date.now(),
    payload: JSON.stringify({ Last_Name: 'Website test', Email: s.email, Project_Type: 'Brand Activations',
      Description: 'This is a test sent from /insider to check that website enquiries reach this inbox.', Submit_Form: 'quote' }),
  });
  msg.subject = '[Test] ' + msg.subject;
  const r = await sendMail(msg);
  res.status(r.ok ? 200 : 502).json({ ...info, sent: !!r.ok, error: r.ok ? null : r.error });
}
