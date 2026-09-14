import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 150)));
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
const r = await page.evaluate(() => {
  const el = document.getElementById('sc-home-cases');
  if (!el) return { hasScript: false };
  const C = JSON.parse(el.textContent);
  const probe = window.__scHomeProbe = { clicks: 0 };
  document.body.addEventListener('click', () => probe.clicks++, true);
  return { hasScript: true, cases: C.map((c) => c.title + ' / ' + c.slug), photos: C.map((c) => c.photo.split('/').pop()) };
});
console.log(JSON.stringify(r, null, 1));
const target = await page.evaluate(() => {
  const img = [...document.querySelectorAll('img[data-nimg="1"]')].find((i) => (i.src || '').includes('UEFA') && (i.width || 0) > 100);
  if (!img) return null;
  const b = img.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
if (target) {
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(2000);
  const probe = await page.evaluate(() => window.__scHomeProbe && window.__scHomeProbe.clicks);
  console.log('body capture clicks:', probe, '| url:', page.url());
}
await browser.close();