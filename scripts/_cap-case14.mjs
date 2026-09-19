import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const h = await page.evaluate(() => document.body.scrollHeight);
console.log('scrollHeight', h);
// Screenshot a long strip by stitching is complex; instead capture text of every section with y
const segs = await page.evaluate(() => {
  const out = [];
  const all = [...document.querySelectorAll('body *')];
  const seen = new Set();
  for (const n of all) {
    if (seen.has(n)) continue;
    const r = n.getBoundingClientRect();
    const t = (n.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t || r.height < 20) continue;
    const y = Math.round(r.top + scrollY);
    // only capture nodes that themselves have direct text (leaf-ish)
    if ([...n.children].length > 3) continue;
    const key = y + '|' + t.slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ y, tag: n.tagName, cls: String(n.className||'').slice(0,20), t: t.slice(0, 150) });
  }
  return out;
});
for (const s of segs.slice(0, 120)) console.log(s.y + '\t' + s.t);
await browser.close();