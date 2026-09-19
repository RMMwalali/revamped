import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);
const out = await page.evaluate(() => {
  const res = {};
  const t = document.body.innerText;
  res.hasDate = /0\d\.\d\d\.\d\d/.test(t) || t.includes('05.03.26');
  res.hasLondon = t.includes('bringing precision') || t.includes('London hub');
  res.hasInside = t.includes('Inside');
  res.hasWestgate = t.includes('Christmas Campaign at Westgate');
  // prominents slider: count titles with css-zwnf0y and their text
  const titles = [...document.querySelectorAll('.css-zwnf0y')].map(n => (n.innerText||'').replace(/\s+/g,' ').trim());
  res.zwnf0y = titles.filter(Boolean);
  res.zwnf0yCount = titles.length;
  // find hrefs to /insight/ and /project/
  res.insightLinks = [...document.querySelectorAll('a[href*="/insight/"]')].map(a=>a.getAttribute('href'));
  res.projectLinks = [...document.querySelectorAll('a[href*="/project/"]')].map(a=>a.getAttribute('href')).slice(0,20);
  res.imageAlts = [...document.querySelectorAll('img')].map(i=>i.alt).filter(a=>a && a.length>2 && a.length<60).slice(0,50);
  return res;
});
console.log(JSON.stringify(out, null, 1));
console.log('CONSOLE ERRORS:', JSON.stringify(errs.slice(0,8), null, 1));
await browser.close();