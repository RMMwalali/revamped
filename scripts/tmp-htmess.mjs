import { pool } from './db.mjs';
const names = ['Mall Space Monetization', 'Mall Calendar Programming', 'Mall and Retail', 'Malls and Retail'];
const list = await pool.query(
  `SELECT el_id, idx, value, orig_html, updated_at FROM content_overrides
   WHERE page = '/' AND kind = 'text' AND tag = 'H4'
     AND (orig_html = ANY($1) OR value = ANY($1)) ORDER BY updated_at`,
  [names]
);
for (const r of list.rows) {
  console.log(r.el_id, 'idx=' + r.idx, JSON.stringify(r.orig_html), '->', JSON.stringify(r.value), '|', String(r.updated_at).slice(0, 19));
}
await pool.end();