import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  const out = [];
  // every element with a heading or date-looking text, parent context
  const nodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a span')];
  const scored = [];
  nodes.forEach(n => {
    const t = (n.innerText||'').replace(/\s+/g,' ').trim();
    if (!t) return;
    if (/^0\d\.\d\d\.\d\d$/.test(t) || /Highlight projects|Inside StillCraft|bringing precision|London hub|We're|You are planning/i.test(t)) {
      const y = Math.round(n.getBoundingClientRect().top + scrollY);
      scored.push({ y, tag: n.tagName, t: t.slice(0,180) });
    }
  });
  return scored;
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();