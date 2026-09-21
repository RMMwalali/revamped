import {pool} from './db.mjs';
const r = await pool.query(`SELECT page, el_id, kind, LEFT(value,110) AS value, LEFT(orig_html,110) AS orig, updated_at FROM content_overrides ORDER BY updated_at DESC LIMIT 25`);
for (const row of r.rows) console.log(String(row.updated_at).slice(0, 19), row.page, row.el_id, row.kind, JSON.stringify(row.value), '| orig:', JSON.stringify(row.orig));
await pool.end();
