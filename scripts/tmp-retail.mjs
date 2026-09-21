import {pool} from './db.mjs';
const r = await pool.query(`SELECT page, el_id, LEFT(value,140) AS value, LEFT(orig_html,140) AS orig FROM content_overrides WHERE value ILIKE '%retail & malls%' OR value ILIKE '%retail &amp; malls%' OR orig_html ILIKE '%retail%malls%'`);
for (const row of r.rows) console.log(row.page, row.el_id, JSON.stringify(row.value), '| orig:', JSON.stringify(row.orig));
import {readFileSync} from 'node:fs';
const h = readFileSync('dist/index.html', 'utf8');
console.log('raw Retail & Malls count:', h.split('Retail & Malls').length - 1, 'raw >Sports</h4:', h.split('>Sports</h4>').length - 1);
await pool.end();
