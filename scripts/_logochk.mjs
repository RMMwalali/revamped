import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const out = {};
  const header = document.querySelector('header');
  if (header) {
    const img = header.querySelector('img');
    if (img) out.logoImg = { src: img.src.slice(0, 120), cls: img.className.toString().slice(0, 60), w: img.naturalWidth, h: img.naturalHeight, cssw: img.style.width, csst: img.style.transform };
    const svg = header.querySelector('svg');
    if (svg) out.logoSvg = { cls: svg.className?.baseVal || svg.getAttribute('class'), w: svg.getAttribute('width'), h: svg.getAttribute('height'), viewBox: svg.getAttribute('viewBox'), innerHTML: svg.innerHTML.slice(0, 300) };
    const texts = [...header.querySelectorAll('a, span, p, div')].filter((e) => (e.textContent || '').trim().includes('StillCraft') || (e.textContent || '').trim().includes('Iventions'));
    out.textHits = texts.slice(0, 3).map((e) => ({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 60), txt: e.textContent.trim().slice(0, 50) }));
  }
  const nav = document.querySelector('nav') || header;
  out.navH = nav ? nav.getBoundingClientRect().height : null;
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();