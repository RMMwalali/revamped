import { chromium } from 'playwright';

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);

const header = await pg.evaluate(() => {
  const fig = document.querySelector('.styles_logo__7LWm4') || document.querySelector('[class*="logo__"]');
  if (!fig) return null;
  const figRect = fig.getBoundingClientRect();
  const headerEls = [];
  const hdr = fig.closest('header [class*="nav"]') || fig.parentElement?.parentElement?.parentElement;
  const all = Array.from(document.querySelectorAll('header [class*="styles_nav__"], header nav, header [class*="styles_header__"], header [class*="styles_top"]'));
  for (const el of all.slice(0, 3)) {
    const r = el.getBoundingClientRect();
    headerEls.push({ cls: el.className.slice(0, 60), x: r.x, w: r.width });
  }
  const imgs = Array.from(fig.querySelectorAll('img')).map((i) => {
    const r = i.getBoundingClientRect();
    return { src: i.getAttribute('src'), x: r.x, y: r.y, w: r.width, h: r.height, nat: i.naturalWidth + 'x' + i.naturalHeight };
  });
  const navLinks = Array.from(document.querySelectorAll('header a')).map((a) => {
    const r = a.getBoundingClientRect();
    return a.textContent.trim().slice(0, 20) + '@x=' + Math.round(r.x);
  }).slice(0, 12);
  return {
    viewportW: window.innerWidth,
    fig: { x: Math.round(figRect.x), y: Math.round(figRect.y), w: Math.round(figRect.width), h: Math.round(figRect.height), center: Math.round(figRect.x + figRect.width / 2) },
    imgs, navLinks,
    headerEls
  };
});
console.log(JSON.stringify(header, null, 1));
await b.close();
process.exit(0);