import { pool } from './db.mjs';
import { chromium } from 'playwright';

const home = await pool.query(
  `SELECT el_id, kind, tag, idx, value v, orig_html o, updated_at
   FROM content_overrides WHERE page='/' ORDER BY updated_at`);
console.log('home overrides:', home.rows.length);
for (const x of home.rows)
  console.log(' ', String(x.el_id).padEnd(13), x.kind.padEnd(4), (x.tag||'').padEnd(5),
    '#'+(x.idx||0), '|', JSON.stringify(String(x.v).slice(0,40)), '|',
    JSON.stringify(String(x.o).slice(0,20)), '|', String(x.updated_at).slice(0,10));

const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:3105/', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(12000); // fully hydrated
const t = await p.evaluate(() => document.body.innerText);
console.log('\nrendered home contains each override value (post-hydration):');
for (const x of home.rows)
  console.log('  ', String(x.el_id).padEnd(13),
    t.includes(String(x.v)) ? 'OK   ' : 'MISS ', JSON.stringify(String(x.v).slice(0,40)));
await b.close();
await pool.end();