import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);
const r = await page.evaluate(() => {
  const hits = [];
  const logoEls = [...document.querySelectorAll('[class*="logo" i]')];
  for (const e of logoEls.slice(0, 6)) hits.push({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 50), computedW: getComputedStyle(e).width });
  const imgs = [...document.querySelectorAll('img')].filter((i) => (i.getAttribute('src') || '').includes('logo'));
  return { logoEls: hits, logoImgs: imgs.map((i) => ({ src: i.getAttribute('src'), w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height, style: i.getAttribute('style') })) };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();