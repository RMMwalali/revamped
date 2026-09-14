import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].filter((i) => (i.src || '').includes('uploads'));
  const out = [];
  for (const img of imgs.slice(0, 4)) {
    let el = img;
    const anc = [];
    for (let d = 0; d < 8 && el; d++) {
      el = el.parentElement;
      if (el) anc.push(el.tagName + '(' + (el.className || '').toString().slice(0, 50) + ')' + (el.getAttribute ? (el.getAttribute('href') ? ' HREF=' + el.getAttribute('href').slice(0, 60) : '') : ''));
    }
    out.push({ src: img.src.slice(0, 90), ancestors: anc });
  }
  return out;
});
for (const x of info) console.log(JSON.stringify(x, null, 1));
await browser.close();