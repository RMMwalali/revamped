import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:3000', { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(2500);
const d = await p.evaluate(() => {
  const sec = document.querySelector('.css-5ohagv');
  if (!sec) return { err: 'no css-5ohagv' };
  let chain = [];
  let n = sec;
  while (n) { chain.unshift((n.className || '').toString()); n = n.parentElement; }
  const out = [];
  function tree(el, depth) {
    if (!el || depth > 7) return;
    const h = Math.round(el.getBoundingClientRect().height);
    const cls = (el.className || '').toString().split(' ').slice(0, 4).join(' ');
    out.push('  '.repeat(depth) + '<' + (el.tagName || '?').toLowerCase() + ' ".' + cls + '" h=' + h);
    for (const c of el.children) tree(c, depth + 1);
  }
  tree(sec, 0);
  return { chain, out };
});
console.log('CHAIN:', d.chain.join(' > '));
d.out.forEach(l => console.log(l));
await b.close();
