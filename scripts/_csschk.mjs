import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(800);
const r = await pg.evaluate(async () => {
  const fig = document.querySelector('[class*="logo__"]');
  if (!fig) return { err: 'no fig' };
  const div = fig.querySelector('div');
  const img = fig.querySelector('img');
  const out = {};
  if (div) {
    const cs = getComputedStyle(div);
    Object.assign(out, { divW: div.getBoundingClientRect().width, divDisplay: cs.display, divJustify: cs.justifyContent, divAlign: cs.alignItems, divWidthCss: cs.width });
  }
  if (img) {
    const cs = getComputedStyle(img);
    Object.assign(out, { imgDisplay: cs.display, imgMargin: cs.margin, imgPos: cs.position });
  }
  // find matching stylesheet rules for css-sjw2nw and logo
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rl of rules) {
      if (rl.selectorText && rl.selectorText.includes('logo__') || (rl.selectorText && rl.selectorText.includes('sjw2nw'))) {
        out[ rl.selectorText ] = rl.cssText.slice(0, 400);
      }
    }
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);