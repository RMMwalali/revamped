import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:3000', { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(2500);
const d = await p.evaluate(() => {
  const body = document.body;
  const out = [];
  for (const el of body.children) {
    const r = el.getBoundingClientRect();
    out.push({
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 45),
      id: el.id || '',
      top: Math.round(r.top + scrollY),
      h: Math.round(r.height)
    });
  }
  return out;
});
console.log(JSON.stringify(d, null, 1));
await b.close();
