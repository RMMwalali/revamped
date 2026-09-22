import { pool } from './db.mjs';
import { chromium, selectors } from 'playwright';

const r = await pool.query(
  `SELECT el_id, kind, tag, idx, left(value,36) v, left(orig_html,22) o, updated_at
   FROM content_overrides WHERE page='/' AND kind IN ('img','image') ORDER BY updated_at`);
console.log('home IMAGE-kind overrides in DB:', r.rows.length);
for (const x of r.rows)
  console.log(' ', x.el_id.padEnd(13), '#'+(x.idx??0), '|', JSON.stringify(x.v), '|', JSON.stringify(x.o), '|', String(x.updated_at).slice(5,16));

const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:3105/', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(4000);
const imgs = await p.evaluate(() =>
  Array.from(document.images).map(i => ({ src: i.getAttribute('src'), alt: i.alt })));
console.log('\nrendered <img> on home:', imgs.length);
for (const i of imgs) console.log('  ', JSON.stringify(i.src), '| alt:', JSON.stringify(i.alt));
await b.close();
await pool.end();