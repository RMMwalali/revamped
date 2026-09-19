import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
await page.evaluate(() => window.scrollTo(0, 9000));
await page.waitForTimeout(2500);
const dump = await page.evaluate(() => {
  const cls = ['css-5ohagv', 'css-9nnxn7', 'css-3rlusp', 'css-0'];
  const out = [];
  for (const c of cls) {
    document.querySelectorAll('.' + c).forEach(n => {
      if (out.some(o => o.node === n)) return;
      const h = n.outerHTML.slice(0, 3000);
      const t = (n.innerText || '').replace(/\s+/g, ' ').trim();
      const y = Math.round(n.getBoundingClientRect().top + scrollY);
      const imgs = [...n.querySelectorAll('img')].map(i => i.alt).filter(Boolean);
      out.push({ cls: c, y, t: t.slice(0, 140), imgs, html: h });
    });
  }
  return out.slice(0, 4);
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();