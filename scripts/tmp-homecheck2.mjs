import { pool } from './db.mjs';
import { chromium } from 'playwright';

const r = await pool.query(
  `SELECT el_id, kind, tag, idx, value, orig_html, updated_at
   FROM content_overrides WHERE page='/' ORDER BY updated_at`);
console.log('homepage overrides in DB:', r.rows.length);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3105/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const domVal = await page.evaluate(() => document.body.innerText顯();

for (const x of r.rows) {
  const v = String(x.value);
  console.log(
    String(x.el_id).padEnd(14), x.kind.padEnd(6), (x.tag||'').padEnd(6), '#'+(x.idx??0),
    '| SHOWN:', domVal.includes(v),
    '|', JSON.stringify(v.slice(0, 34)),
    '|', JSON.stringify(String(x.orig_html).slice(0, 20)));
}
await browser.close();
await pool.end();