import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/about', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
const r = await page.evaluate(() => {
  const t = document.querySelector('header');
  if (!t) return 'no header';
  const logo = t.querySelector('.styles_logo, figure, img[alt="logo"]');
  const res = [];
  const fig = t.querySelector('figure');
  if (fig) { const b = fig.getBoundingClientRect(); res.push({ node: 'figure', w: b.width, h: b.height, cls: fig.className.toString(), cs: getComputedStyle(fig).width + ' ' + getComputedStyle(fig).height }); }
  const img = t.querySelector('img[alt="logo"]');
  if (img) { const b = img.getBoundingClientRect(); res.push({ node: 'img', w: b.width, h: b.height, src: (img.getAttribute('src') || '').slice(0, 90), cs: getComputedStyle(img).width + ' / ' + getComputedStyle(img).height }); }
  const center = t.querySelector('.styles_header_container__center');
  if (center) res.push({ node: 'center', cls: center.className.toString(), html: center.innerHTML.slice(0, 300) });
  return res;
});
console.log(JSON.stringify(r, null, 1));
await browser.close();