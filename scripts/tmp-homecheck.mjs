import { pool } from './db.mjs';
import { chromium } from 'playwright';

const pageId = '/';
const r = await pool.query(
  `SELECT el_id, kind, tag, idx, left(value,46) v, left(orig_html,26) o, updated_at
   FROM content_overrides WHERE page=$1 ORDER BY updated_at`, [pageId]);
console.log('home overrides in DB:', r.rows.length);
for (const x of r.rows)
  console.log(' ', x.el_id.padEnd(14), x.kind.padEnd(6), (x.tag||'').padEnd(5), '#'+(x.idx??0),
    '|', JSON.stringify(x.v), '|', JSON.stringify(x.o), '|', String(x.updated_at).slice(5,16));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3105/', { waitUntil: 'networkidle', timeout: 60000 });
const checks = await page.evaluate(async (vals) => {
  const t = () => document.body.innerText;
  const rec = { t0: t(), t5: null, t12: null };
  await new Promise(r => setTimeout(r, 9500));
  rec.t5 = t();
  await new Promise(r => setTimeout(r, 3500));
  rec.t12 = t();
  const out = {};
  for (const [i, v] of vals) {
    out[i] = {
      s: rec.t0.includes(v), m: rec.t5.includes(v), l: rec.t12.includes(v),
      first: rec.t0.indexOf(v) > -1 ? rec.t0.indexOf(v) : null,
      count: t.length };
  }
  return out;
}, r.rows.map((x, i) => [i, x.v]));
console.log(JSON.stringify(checks, null, 1));
await browser.close();
await pool.end();