import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(9000);
const out = await p.evaluate(() => {
  const r = {};
  const sec = [...document.querySelectorAll('section')].find(x => /talent/i.test(x.className||''));
  if (!sec) return { found: false };
  r.found = true;
  r.bg = getComputedStyle(sec).backgroundColor;
  r.grid = !!sec.querySelector('.sc-team-grid');
  r.cards = sec.querySelectorAll('.sc-team-card').length;
  r.h2 = (() => { const h2 = sec.querySelector('h2'); const cs = h2 && getComputedStyle(h2); return { txt: h2 && h2.textContent.trim(), color: cs && cs.color, size: cs && cs.fontSize }; })();
  r.intro = (() => { const el = sec.querySelector('[class*="Paragraph"]'); if(!el) return 'none'; const cs = getComputedStyle(el); return { txt: el.textContent.trim().slice(0,60), color: cs.color, size: cs.fontSize }; })();
  const c1 = sec.querySelector('.sc-team-card');
  r.card1 = c1 ? { bg: getComputedStyle(c1).backgroundColor, txt: c1.textContent.trim().slice(0, 120) } : null;
  r.cardText = (() => {
    const h3 = sec.querySelector('.sc-team-card h3');
    const role = sec.querySelector('.sc-team-role');
    const bio = sec.querySelector('.sc-team-bio');
    const g = (e) => e && getComputedStyle(e);
    return { name: h3 && h3.textContent, h3Color: g(h3) && g(h3).color, h3Size: g(h3) && g(h3).fontSize, roleColor: g(role) && g(role).color, roleSize: g(role) && g(role).fontSize, bioColor: g(bio) && g(bio).color, bioSize: g(bio) && g(bio).fontSize };
  })();
  r.sectionRect = { w: sec.offsetWidth, h: sec.offsetHeight };
  return r;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
