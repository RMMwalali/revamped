import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push('PGERR ' + (e.message || '').slice(0, 140)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('Failed to load') && !t.includes('cookie')) logs.push('LOG ' + t.slice(0, 120)); });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5500);
const r1 = await page.evaluate(() => {
  const img = [...document.querySelectorAll('img[data-nimg="1"]')].find((i) => (i.src || '').includes('UEFA') && (i.width || 0) > 100);
  if (!img) return { found: false };
  const box = img.getBoundingClientRect();
  return { found: true, x: box.x + box.width / 2, y: box.y + box.height / 2, src: img.src.slice(0, 90) };
});
console.log('click target:', r1.found ? 'UEFA img' : 'NOT FOUND');
if (r1.found) {
  await page.mouse.click(r1.x, r1.y);
  await page.waitForTimeout(5000);
  console.log('URL after slide click:', page.url());
}
await browser.close();