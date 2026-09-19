import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errLog = [];
page.on('pageerror', e => { if (!errLog.length) errLog.push({ at: Date.now(), msg: (e.message || '').slice(0, 300), stack: (e.stack || '').split('\n').slice(0, 3).join(' | ').slice(0, 300) }); });
page.on('console', m => { if (m.type() === 'error') { if (!errLog.some(x => x.console === m.text())) errLog.push({ at: Date.now(), console: m.text().slice(0, 200) }); } });

await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000apsed);

// Walk scroll in steps, capture body text around the "after stats" section + headings per step
const steps = [];
for (let y = 0; y <= 6200; y += 500) {
  await page.evaluate(yh => window.scrollTo(0, yh), y);
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => {
    const hasErr = /Application error: a client-side exception/i.test(document.body ? document.body.innerText : '');
    const h2s = [...document.querySelectorAll('h2,h3')].map(h => ({ t: h.innerText.replace(/\n/g, ' ').slice(0, 34), y: Math.round(h.getBoundingClientRect().top + scrollY) })).filter(x => Math.abs(x.y - scrollY) < 700);
    return { hasErr, h2s: h2s.slice(0, 3) };
  });
  steps.push({ y, err: hit.hasErr, near: hit.h2s.map(h => h.t) });
  if (hit.hasErr) { steps.push({ y, err: true }); break; }
}
console.log(JSON.stringify(steps.map(s => ({ y: s.y, err: !!s.err, near: (s.near || []).join(' ; ') })), null, 1));
console.log('errLog:', JSON.stringify(errLog, null, 1));
await browser.close();