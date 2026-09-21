import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0,200)));
await p.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(9000);
const out = {};
out.scrollH = await p.evaluate(() => document.documentElement.scrollHeight);
out.sections = await p.evaluate(() => {
  const res = [];
  const main = document.querySelector('main');
  const txt = (main ? main.innerText : document.body.innerText) || '';
  const keys = ['Inside','05.03','London hub','Iventions','Highlight projects','VIEW OUR WORK','Easter at Galleria','World Cup Watch','Christmas Campaign','Valentine','Mother'];
  for (const k of keys) res.push(k + ' : ' + (txt.indexOf(k) >= 0 ? 'YES' : 'no'));
  return res;
});
out.h3s = await p.evaluate(() => {
  return [...document.querySelectorAll('h1,h2,h3,h4')].map(e => e.textContent.trim()).filter(t => t && t.length < 120).slice(0, 60);
});
out.insight = await p.evaluate(() => {
  const box = document.querySelector('main [class*="styles_invention"], main [class*="invention"]');
  if (!box) return 'NO INVENTION BOX';
  return box.innerText.slice(0, 2000);
});
out.errs = errs.slice(0, 5);
console.log(JSON.stringify(out, null, 1));
await b.close();
