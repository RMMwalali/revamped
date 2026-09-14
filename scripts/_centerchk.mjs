import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(800);
const r = await pg.evaluate(() => {
  const fig = document.querySelector('[class*="logo__"]');
  const img = fig && fig.querySelector('img');
  if (!img) return { err: 'no img' };
  const ir = img.getBoundingClientRect();
  const fr = fig.getBoundingClientRect();
  return {
    vw: window.innerWidth,
    figW: Math.round(fr.width), figX: Math.round(fr.x),
    imgX: Math.round(ir.x), imgW: Math.round(ir.width),
    imgCenter: Math.round(ir.x + ir.width / 2),
    vwCenter: window.innerWidth / 2,
    diff: Math.round(ir.x + ir.width / 2 - window.innerWidth / 2),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
process.exit(0);
