import {pool} from './db.mjs';
const r = await pool.query(`SELECT el_id, LEFT(value,140) AS value, LEFT(orig_html,140) AS orig FROM content_overrides WHERE page='/' AND (value ILIKE '%sport%' OR value ILIKE '%our work%' OR value ILIKE '%retail%' OR orig_html ILIKE '%sport%')`);
for (const row of r.rows) console.log(row.el_id, JSON.stringify(row.value), '| orig:', JSON.stringify(row.orig));
console.log('done, rows:', r.rows.length);
await pool.end();
