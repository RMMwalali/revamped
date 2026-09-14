import { chromium } from 'playwright';

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);

const info = await pg.evaluate(() => {
  const fig = document.querySelector('.styles_logo__7LWm4') || document.querySelector('[class*="logo__"]');
  if (!fig) return { error: 'no fig' };
  const figR = fig.getBoundingClientRect();

  // Trace parent chain up to <header>
  const chain = [];
  let el = fig;
  while (el && el.tagName !== 'HEADER') {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    chain.push({
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 50),
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.x), y: Math.round(r.y),
      display: cs.display,
      justify: cs.justifyContent,
      align: cs.alignItems,
      pos: cs.position,
    });
    el = el.parentElement;
  }
  if (el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    chain.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 50), w: Math.round(r.width), x: Math.round(r.x), display: cs.display, justify: cs.justifyContent, align: cs.alignItems, pos: cs.position });
  }

  // The inner div inside fig
  const inner = fig.querySelector('div');
  const img = fig.querySelector('img');
  let innerInfo = null;
  if (inner) {
    const r = inner.getBoundingClientRect();
    const cs = getComputedStyle(inner);
    innerInfo = { cls: (inner.className || '').slice(0, 50), x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), justify: cs.justifyContent, align: cs.alignItems };
  }
  let imgInfo = null;
  if (img) {
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    imgInfo = { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), pos: cs.position, fit: cs.objectFit };
  }

  return { fig: { x: Math.round(figR.x), w: Math.round(figR.width), h: Math.round(figR.height) }, inner: innerInfo, img: imgInfo, chain };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
process.exit(0);