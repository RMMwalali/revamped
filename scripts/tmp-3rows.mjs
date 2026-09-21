import {pool} from './db.mjs';
const r = await pool.query(`SELECT el_id, idx, tag, kind, value, orig_html FROM content_overrides WHERE page = '/' AND el_id IN ('amubgm1ybd1','amubgm2m64i','amubgm4i8we') ORDER BY idx`);
for (const x of r.rows) console.log(x.idx, x.el_id, x.tag, JSON.stringify(x.value), '| orig=', JSON.stringify(x.orig_html));
await pool.end();