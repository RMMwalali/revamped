import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const out = await page.evaluate(() => {
  const secs = [];
  document.querySelectorAll('section, main > div').forEach((s, i) => {
    const t = (s.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    const y = Math.round(s.getBoundingClientRect().top + scrollY);
    if (secs.some(x => Math.abs(x.y - y) < 30)) return;
    secs.push({ i, y, tag: s.tagName, cls: String(s.className||'').slice(0,30), t: t.slice(0, 220) });
  });
  return secs.sort((a,b)=>a.y-b.y);
});
console.log(JSON.stringify(out, null, 1));
await browser.close();