import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(8000);
const out = await p.evaluate(() => {
  const s = [...document.querySelectorAll('section')].find(x => /talent/i.test(x.className||''));
  if (!s) return 'NO SECTION';
  const cards = [...s.querySelectorAll('[class*="styles_main_right"], [class*="css-164x2ri"], [class*="css-1hzj7rl"]')];
  const pick = cards[1];
  return pick ? pick.outerHTML.slice(0, 3000) : s.innerHTML.slice(0, 2500);
});
console.log(out);
await b.close();
