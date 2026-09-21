import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(8000);
const out = await p.evaluate(() => {
  const s = [...document.querySelectorAll('section')].find(x => /talent/i.test(x.className||''));
  const r = { section: null, items: [] };
  s && (r.section = { cls: s.className, bg: getComputedStyle(s).backgroundColor, h: s.offsetHeight, w: s.offsetWidth });
  const all = [...s.querySelectorAll('h1,h2,h3,h4,p,div,span,button')];
  for (const el of all) {
    const cs = getComputedStyle(el);
    const tr = el.getBoundingClientRect();
    const txt = (el.textContent||'').trim();
    if (!txt) continue;
    const vis = tr.width>4 && tr.height>4 && el.offsetParent!==null;
    const parentText = (el.parentElement.textContent||'').trim();
    if (parentText === txt) continue;
    r.items.push({
      tag: el.tagName, cls: (typeof el.className==='string'?el.className:'').slice(0,45),
      t: txt.slice(0,38), vis, op: getComputedStyle(el).opacity,
      y: Math.round(tr.y), h: Math.round(tr.height),
      c: cs.color, s: Math.round(parseFloat(cs.fontSize)),
      pbg: getComputedStyle(el.parentElement).backgroundColor,
    });
  }
  return r;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
