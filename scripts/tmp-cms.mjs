import {pool} from './db.mjs';
const r = await pool.query(`SELECT section, LEFT(data::text,200) AS data FROM cms_sections`);
for (const row of r.rows) console.log(row.section, '|', row.data);
const r2 = await pool.query(`SELECT data::text AS d FROM cms_sections WHERE data::text ILIKE '%retail%' OR data::text ILIKE '%sport%'`);
console.log('retail/sport rows:', r2.rows.length);
for (const row of r2.rows) console.log(row.d.slice(0, 400));
await pool.end();
