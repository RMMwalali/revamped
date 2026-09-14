import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);
const html = await page.evaluate(() => {
  const el = document.querySelector('.css-1ndbw87');
  if (!el) return 'nf';
  let h = el.outerHTML;
  return h;
});
const i = html.indexOf('css-jl85b3');
console.log(html.slice(i, Math.min(html.length, i + 3200)));
await browser.close();