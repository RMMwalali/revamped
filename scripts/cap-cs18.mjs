import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const failed = [];
p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().slice(0,180)); });
p.on('pageerror', e => failed.push('PAGEERR ' + String(e).slice(0,200)));
await p.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(12000);
const out = {};
out.fonts = await p.evaluate(() => document.fonts ? document.fonts.status : 'n/a');
out.invention = await p.evaluate(() => {
  const all = [...document.querySelectorAll('div')];
  const hit = all.find(d => /invention/i.test(d.className || ''));
  if (!hit) return 'NO BOX';
  return { cls: hit.className, txt: hit.innerText.slice(0, 1500) };
});
out.errs = failed.slice(0, 8);
console.log(JSON.stringify(out, null, 1));
await b.close();
