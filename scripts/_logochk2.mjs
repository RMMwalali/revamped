import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/about', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
const r = await page.evaluate(() => {
  const h = document.querySelector('header');
  if (!h) return 'no header';
  const logoBits = [...h.querySelectorAll('*')].filter((e) => (e.className || '').toString().match(/logo|Logo|brand|Brand/) && e.children.length === 0);
  const imgs = [...h.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), cls: i.className.toString().slice(0, 50) }));
  const svgs = [...h.querySelectorAll('svg')].length;
  const html = h.outerHTML.slice(0, 3000);
  return { logoBits: logoBits.map((e) => ({ tag: e.tagName, cls: (e.className || '').toString(), txt: (e.textContent || '').trim().slice(0, 30) })), imgs, svgs, html };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();