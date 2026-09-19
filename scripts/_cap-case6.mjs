import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('div[class*=css]').forEach(n => {
    const t = (n.innerText || '').replace(/\s+/g, ' ').trim();
    if (!/PARTICIPANTS|EVENT TYPE|CASE STUDY|Industry/.test(t)) return;
    if (t.length < 20 || t.length > 2000) return;
    const y = Math.round(n.getBoundingClientRect().top + scrollY);
    if (y < 8000 || y > 11000) return;
    const imgs = [...n.querySelectorAll('img')].map(i => ({ alt: i.alt, src: (i.src || '').split('?')[0].split('/').slice(-2).join('/') })).slice(0, 3);
    const html = n.outerHTML.slice(0, 2200);
    out.push({ cls: String(n.className).slice(0, 30), y, t: t.slice(0, 200), imgs, html });
  });
  // dedupe by cls+y
  const seen = new Set();
  const ded = out.filter(o => { const k = o.cls + '|' + o.y; if (seen.has(k)) return false; seen.add(k); return true; });
  return ded.slice(0, 6);
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();