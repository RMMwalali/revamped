import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
const issues = [];
p.on('console', m => issues.push('CONSOLE[' + m.type() + '] ' + m.text().slice(0,160)));
p.on('pageerror', e => issues.push('PAGEERR ' + String(e).slice(0,200)));
p.on('requestfailed', r => issues.push('REQFAIL ' + r.url().slice(0,140) + ' ' + (r.failure() || {}).errorText));
p.on('response', r => { if (r.status() >= 400) issues.push('HTTP' + r.status() + ' ' + r.url().slice(0,140)); });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(15000);
const out = {};
out.allInsightText = await p.evaluate(() => {
  const body = document.body.innerText || '';
  const pos = body.indexOf('Inside');
  return { hasInside: pos >= 0, aroundInside: pos >= 0 ? body.slice(pos-60, pos+400) : '' };
});
out.cards = await p.evaluate(() => {
  const boxes = [...document.querySelectorAll('a[href*="/insight/"], a[href*="/insights"]')];
  return boxes.map(a => a.href + ' :: ' + a.innerText.replace(/\s+/g,' ').slice(0,140)).slice(0, 20);
});
out.issues = issues.slice(0, 12);
console.log(JSON.stringify(out, null, 1));
await b.close();
