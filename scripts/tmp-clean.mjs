import { pool } from './db.mjs';
const ids = ['amubgm1ybd1', 'amubgm2m64i', 'amubgm4i8we', 'amubhh70sbl', 'amubhh7pezg', 'amubhh8sjiy', 'amubhhl4i71', 'amubhhlq2xr', 'amubhj88v6m'];
const del = await pool.query(`DELETE FROM content_overrides WHERE page = '/' AND el_id = ANY($1) RETURNING el_id`, [ids]);
console.log('deleted', del.rowCount, 'rows');
const ins = await pool.query(
  `INSERT INTO content_overrides (page, el_id, kind, value, orig_html, idx, tag, updated_at)
   VALUES ('/', 'amallcalendar03', 'text', 'Mall Calendar Programming', 'Mall Space Monetization', 0, 'H4', now())
   ON CONFLICT (page, el_id) DO UPDATE SET value = EXCLUDED.value, orig_html = EXCLUDED.orig_html, idx = 0, tag = 'H4', updated_at = now()`
);
console.log('inserted', ins.rowCount);
const check = await pool.query(
  `SELECT el_id, kind, tag, idx, value, orig_html FROM content_overrides
   WHERE page = '/' AND tag = 'H4' ORDER BY updated_at DESC`);
console.log('remaining H4 overrides on / :');
for (const r of check.rows) console.log(' ', r.el_id, r.tag, JSON.stringify(r.orig_html), '->', JSON.stringify(r.value));
await pool.end();