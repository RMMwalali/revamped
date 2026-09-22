import { pool } from './db.mjs';
import { chromium } from 'playwright';

const r = await pool.query(
  `SELECT el_id, kind, tag, idx, value, orig_html, updated_at
   FROM content_overrides WHERE page='/' ORDER BY updated_at`);
console.log('HOME overrides in DB:', r.rows.length);
for (const x of r.rows)
  console.log(' ', String(x.el_id).padEnd(13), x.kind.padEnd(4),
    (x.tag||'').padEnd(3), '#'+(x.idx??0), '|',
    JSON.stringify(String(x.value).slice(0,42)), '|',
    JSON.stringify(String(x.orig_html).slice(0,16)));

// Now fetch live home and count which override values are present after hydration
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:3105/', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(11000pw); // well past hydration
const bodyText = await p.evaluate(() => document.body.innerText);
const imgSrc = await p.evaluate(() =>
  Array.from(document.querySelectorAll('img')).map(i => i.getAttribute('src')));
let presentText = 0, presentImg = 0;
for (const x of r.rows) {
  const v = String(x.value);
  const hit = x.kind === 'img'
    ? imgSrc.some(s => s === v || (s && s.includes(v)))
    : bodyText.includes(v);
  if (hit) hit ? presentText++ : presentText, presentImg = x.kind==='img' ? presentImg+1 : presentImg;
  console.log('   live', hit ? 'OK ' : 'MISS', String(x.el_id).padEnd(13), JSON.stringify(v.slice(0,30)));
}
console.log('\nhome: text-hit', presentText, '/img-hit', presentImg);
await b.close();
await pool.end();