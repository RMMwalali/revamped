import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  document.querySelectorAll('section,article,[class*=case],[class*=Slider],div').forEach(n => {
    const t = (n.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 30 || t.length > 5000) return;
    if (seen.has(t)) return;
    if (!/PARTICIPANTS|CASE STUDY|Galleria|Easter|project|Highlight|World Cup|Christmas|MOTHER|Valentine/i.test(t)) return;
    seen.add(t);
    const r = n.getBoundingClientRect();
    const y = Math.round(r.top + scrollY);
    if (y < 1500 || y > 11500) return;
    const imgs = [...n.querySelectorAll('img')].map(i => ({ alt: i.alt, src: (i.src || '').slice(0, 80) })).slice(0, 4);
    out.push({ tag: n.tagName, cls: String(n.className).slice(0, 44), y, len: t.length, t: t.slice(0, 260), imgs });
  });
  const out2 = [];
  const cardlabels = [];
  document.querySelectorAll('[class*=case]').forEach(n => {
    const y = Math.round(n.getBoundingClientRect().top + scrollY);
    const t = (n.innerText || '').replace(/\s+/g, ' ').trim();
    if (t) cardlabels.push({ cls: String(n.className).slice(0, 40), y, t: t.slice(0, 120) });
  });
  return { blocks: out.slice(0, 12), cardlabels: cardlabels.slice(0, 15) };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();