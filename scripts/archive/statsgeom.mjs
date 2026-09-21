import { chromium } from 'playwright';
for (const [name, url] of [['ORIG', 'https://iventions.com'], ['LOCAL', 'http://127.0.0.1:3000']]) {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo(0, 9495));
  await p.waitForTimeout(1500);
  const d = await p.evaluate(() => {
    const res = {};
    for (const sel of ['.css-3rlusp', '.css-ctko3l', '.css-woa673', '.css-lvtjah', '.css-7jq3c1', '.css-x75brr', '.css-71o8z3', '.css-ufa12r', '.css-41c6dw', '.css-12ybk68', '.css-jp7bfh']) {
      const el = document.querySelector(sel);
      if (!el) { res[sel] = 'ABSENT'; continue; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      res[sel] = { top: Math.round(r.top + scrollY), h: Math.round(r.height), pos: cs.position };
    }
    return res;
  });
  console.log('[' + name + ']');
  Object.entries(d).forEach(([k, v]) => console.log('  ' + k, JSON.stringify(v)));
  await b.close();
}
