import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(8000);
const out = await p.evaluate(() => {
  const s = [...document.querySelectorAll('section')].find(x => /talent/i.test(x.className||''));
  const first = s.querySelector('.styles_right_talent___dgp0');
  const item1 = first ? first.outerHTML.slice(0,700) : 'none';
  const icon = s.querySelector('.styles_icon__6VgIW');
  const iconHtml = icon ? icon.outerHTML.slice(0,400) : 'none';
  const iconCs = icon ? getComputedStyle(icon) : null;
  const pEl = s.querySelector('.styles_job__Air0d');
  const pCs = pEl ? getComputedStyle(pEl) : null;
  return { item1, iconHtml, icon: iconCs && { bg: iconCs.backgroundColor, border: iconCs.border, w: iconCs.width, h: iconCs.height }, job: pCs && { color: pCs.color, size: pCs.fontSize, weight: pCs.fontWeight, family: pCs.fontFamily } };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
