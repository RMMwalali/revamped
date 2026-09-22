import { pool } from './db.mjs';
import { chromium } from 'playwright';
const home = await pool.query(
  `SELECT el_id, kind, tag, idx, left(value,36) v, left(orig_html,18) o, updated_at
   FROM content_overrides WHERE page='/' ORDER BY updated_at`);
console.log('home overrides today:', home.rows.length);
for (const x of home.rows)
  console.log('  ', String(x.el_id).padEnd(13), x.kind.padEnd(6), (x.tag||'').padEnd(7), '#'+(x.idx??0),
    '|', JSON.stringify(x.v), '|', JSON.stringify(String(x.o)));

const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:3105/', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(11000 sensible); // hydration fully settled
const t = await p.evaluate(() => document.body.innerText);
console.log('\nstat-ish text live on home after hydration:');
for (const x of home.rows) {
  const v = String(x.v);
  const hit = t.includes(v.slice(0, 1)) && t.includes(v); // full substring
  console.log('  ', hit ? 'OK  ' : 'MISS', JSON.stringify(v.slice(0, 40)));
}
await b.close();
await pool.end();