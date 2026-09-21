import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:3459/_bisect-v2-title', { waitUntil: 'load', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  const h = document.body.scrollHeight;
  for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
});
await page.waitForTimeout(2000);
const h4s = await page.evaluate(() => [...document.querySelectorAll('a[href^="/insight/"] h4')].map((h) => h.getAttribute('aria-label') + ' ||| ' + h.innerText.slice(0, 60)));
h4s.forEach((h) => console.log(JSON.stringify(h)));
await browser.close();
