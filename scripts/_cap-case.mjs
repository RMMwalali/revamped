import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const seen = new Set();
const errs = [];
page.on('pageerror', e => { const m = (e.stack || e.message || '').slice(0, 900); const k = m.slice(0, 90); if (!seen.has(k)) { seen.add(k); errs.push('PAGERR ' + m); } });
page.on('console', c => { if (c.type() === 'error') { const t = c.text().slice(0, 300); const k = t.slice(0, 90); if (!seen.has(k)) { seen.add(k); errs.push('CONSOLE ' + t); } } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  const out = [];
  const targets = [...document.querySelectorAll('h1,h2,h3,h4,section,article,[class*=case],[class*=Card]')]
    .filter(n => { const y = n.getBoundingClientRect().top + scrollY; return y > 1800 && y < 2800; });
  for (const n of targets.slice(0, 30)) {
    const t = (n.innerText || '').replace(/\s+/g, ' ').slice(0, 220);
    if (!t) continue;
    out.push({ tag: n.tagName, cls: String(n.className).slice(0, 30), y: Math.round(n.getBoundingClientRect().top + scrollY), t });
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1));
console.log('errors:', errs.slice(0, 5).map(x => x.slice(0, 400)));
await browser.close();