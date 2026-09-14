import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const header = document.querySelector('header');
  const img = document.querySelector('img[alt="logo"], figure.styles_logo img, .styles_logo img');
  const fig = document.querySelector('figure.styles_logo, .styles_logo');
  const out = {};
  if (img) {
    const r = img.getBoundingClientRect();
    out.img = { cls: img.className.toString(), src: (img.getAttribute('src') || '').slice(0, 80), w: r.width, h: r.height, naturalW: img.naturalWidth, naturalH: img.naturalHeight, blend: getComputedStyle(img).mixBlendMode, objectFit: getComputedStyle(img).objectFit };
  }
  if (fig) {
    const r = fig.getBoundingClientRect();
    out.figure = { cls: fig.className.toString(), w: r.width, h: r.height, blend: getComputedStyle(fig).mixBlendMode, justify: getComputedStyle(fig).justifyContent };
    const div = fig.querySelector('div');
    if (div) { const d = div.getBoundingClientRect(); out.figdiv = { cls: div.className.toString(), w: d.width, h: d.height, blend: getComputedStyle(div).mixBlendMode }; }
  }
  out.faviconLinks = [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.outerHTML);
  return out;
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'C:/BACKUPS/STILLLCRAFT/_logo-shot.png' });
await browser.close();