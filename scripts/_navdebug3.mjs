import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  window.__log = [];
  const C = JSON.parse(document.getElementById('sc-home-cases').textContent);
  document.addEventListener('click', (e) => {
    const t = e.target;
    const rec = { tag: t.tagName, cls: (t.className || '').toString().slice(0, 40), src: (t.src || '').slice(0, 120) };
    let c = null;
    if (t.closest) {
      const h = t.closest('h3');
      if (h) {
        const txt = h.textContent || '';
        for (const x of C) if (txt.indexOf(x.title) >= 0) c = x;
      }
    }
    if (!c && t.closest) {
      const img = t.closest('img[data-nimg="1"]');
      if (img) for (const x of C) if (img.src.indexOf(encodeURIComponent(x.photo)) >= 0) c = x;
    }
    rec.h3 = c ? c.slug : null;
    rec.imgmatch = null;
    if (t.closest) {
      const img = t.closest('img[data-nimg="1"]');
      if (img) rec.imgmatch = C.map((x) => img.src.indexOf(encodeURIComponent(x.photo)) >= 0 ? 1 : 0);
    }
    window.__log.push(rec);
  }, true);
  window.__log.push('listener attached, C=' + C.length);
});
await page.locator('img[src*="UEFA"]').first().click({ force: true }).catch(() => {});
await page.waitForTimeout(2500);
console.log('url:', page.url());
console.log(JSON.stringify(await page.evaluate(() => window.__log), null, 1));
await browser.close();