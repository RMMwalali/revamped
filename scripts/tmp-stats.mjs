import { pool } from './db.mjs';
const r = await pool.query(
  `SELECT el_id, kind, tag, idx, left(value,44) v, left(orig_html,30) o, updated_at
   FROM content_overrides WHERE page='/' ORDER BY updated_at`);
console.log('home overrides:', r.rows.length);
for (const x of r.rows)
  console.log(' ', x.el_id.padEnd(13), x.kind.padEnd(6), (x.tag||'').padEnd(7), '#'+(x.idx??0),
    '|', JSON.stringify(x.v), '|', JSON.stringify(x.o), '|', String(x.updated_at).slice(0,10));
await pool.end();