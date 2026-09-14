import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push('PGERR ' + (e.message || '').slice(0, 140)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('Failed to load') && !t.includes('cookie banner')) logs.push('LOG ' + t.slice(0, 140)); });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);
const slide = await page.evaluate(() => {
  const el = document.querySelector('.css-1ndbw87');
  if (!el) return null;
  el.scrollIntoView();
  return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), rect: el.getBoundingClientRect() };
});
console.log('slide element:', JSON.stringify(slide));
if (slide) {
  const before = page.url();
  await page.mouse.click(slide.rect.x + slide.rect.width / 2, slide.rect.y + slide.rect.height / 2);
  await page.waitForTimeout(4000);
  console.log('after click:', page.url(), '| changed:', page.url() !== before);
}
console.log('type a click?', await page.evaluate(() => { const e = document.activeElement ? document.activeElement.tagName : '?'; return e; }));
console.log('LOGS:', logs.length ? logs.join(' | ') : 'none');
await browser.close();