import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const seen = new Set();
const errs = [];
page.on('pageerror', e => {
  const m = (e.stack || e.message || '').slice(0, 600);
  const k = m.slice(0, 90);
  if (!seen.has(k)) { seen.add(k); errs.push('PAGERR ' + m); }
});
page.on('console', c => {
  if (c.type() === 'error') {
    const t = c.text().slice(0, 250);
    const k = t.slice(0, 90);
    if (!seen.has(k)) { seen.add(k); errs.push('CONSOLE ' + t); }
  }
});

await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);

// dump all headings with absolute Y first
const hd = await page.evaluate(() => {
  const out = [];
  ['h1', 'h2', 'h3'].forEach(t => document.querySelectorAll(t).forEach(h => {
    const r = h.getBoundingClientRect();
    out.push({ tag: h.tagName, y: Math.round(r.top + window.scrollY), t: h.innerText.replace(/\n/g, ' ').slice(0, 46) });
  }));
  return out.sort((a, b) => a.y - b.y);
});
console.log('HEADINGS:', JSON.stringify(hd, null, 1));

// now scroll deep in steps, recording where a pageerror fires
let crash = null;
for (const stop of [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000]) {
  await page.evaluate(v => window.scrollTo(0, v), stop);
  await page.waitForTimeout(350);
  if (!crash && errs.length) crash = stop;
}
await page.waitForTimeout(4000);
console.log('crash at scrollY:', crash);
console.log('errors:', errs.slice(0, 3).map(x => x.slice(0, 500)));

// capture the case-study section text around the "after stats" area (deep scroll)
const sec = await page.evaluate(() => {
  const out = {};
  const nodes = [...document.querySelectorAll('section,div')].filter(n => /\bparticipants?\b/i.test(n.innerText || '') && (n.innerText || '').length < 4000 && (n.innerText || '').length > 40);
  out.caseSections = nodes.slice(0, 4).map(n => ({ tag: n.tagName, cls: String(n.className).slice(0, 40), y: Math.round(n.getBoundingClientRect().top + scrollY), t: (n.innerText || '').replace(/\s+/g, ' ').slice(0, 180) }));
  out.crashText = /Application error: a client-side exception/i.test(document.body ? document.body.innerText : '');
  out.domLen = document.body.innerText.length;
  return out;
});
console.log('case sections:', JSON.stringify(sec, null, 1));
await browser.close();