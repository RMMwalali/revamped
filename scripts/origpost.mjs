import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('https://iventions.com', { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(2500);
await p.evaluate(() => window.scrollTo(0, 10395));
await p.waitForTimeout(1800);
const d = await p.evaluate(() => {
  const res = [];
  const els = [...document.querySelectorAll('main>div')];
  els.slice(4).forEach((sec, i) => {
    const r = sec.getBoundingClientRect();
    const kids = [...sec.children];
    let out = [];
    function brief(el, depth, arr, md) {
      if (depth > md || !el) return;
      const rr = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      arr.push('  '.repeat(depth) + '.' + (el.className || '').toString().split(' ').slice(0, 2).join(' ') + ' top=' + Math.round(rr.top + scrollY) + ' h=' + Math.round(rr.height) + ' pos=' + cs.position);
      for (const c of el.children) brief(c, depth + 1, arr, md);
    }
    kids.forEach(c => brief(c, 1, out, 2));
    res.push('===== idx ' + (4 + i) + ' top=' + Math.round(r.top + scrollY) + ' h=' + Math.round(r.height) + ' :: ' + (sec.textContent || '').replace(/\s+/g, ' ').slice(0, 30));
    out.forEach(l => res.push(l));
  });
  return res;
});
d.forEach(l => console.log(l));
await b.close();
