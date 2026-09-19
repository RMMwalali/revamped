import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0,200)));
await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(9000);
const out = {};
out.talent = await p.evaluate(() => {
  const sec = document.querySelector('[class*="js-talent-main"], .sc-team-grid');
  if (!sec) return 'NO TEAM GRID';
  return { gridText: sec.innerText.slice(0, 800) };
});
out.teamSection = await p.evaluate(() => {
  const h2 = [...document.querySelectorAll('h2')].find(e => e.textContent.includes('People Behind'));
  if (!h2) return 'NO H2';
  const cs = getComputedStyle(h2);
  return { color: cs.color, fontSize: cs.fontSize, fontFamily: cs.fontFamily, bg: getComputedStyle(h2.closest('section')||h2.parentElement).backgroundColor };
});
out.card = await p.evaluate(() => {
  const card = document.querySelector('.sc-team-card');
  if (!card) return 'NO CARD';
  const cs = getComputedStyle(card);
  return { bg: cs.backgroundColor };
});
out.heading = await p.evaluate(() => {
  const h3 = document.querySelector('.sc-team-card h3');
  if (!h3) return 'NO H3';
  const cs = getComputedStyle(h3);
  return { color: cs.color, fontSize: cs.fontSize, weight: cs.fontWeight };
});
out.role = await p.evaluate(() => {
  const r = document.querySelector('.sc-team-role');
  const cs = r ? getComputedStyle(r) : null;
  return cs ? { color: cs.color, fontSize: cs.fontSize } : 'NO ROLE';
});
out.bio = await p.evaluate(() => {
  const b = document.querySelector('.sc-team-bio');
  const cs = b ? getComputedStyle(b) : null;
  return cs ? { color: cs.color, fontSize: cs.fontSize, lineHeight: cs.lineHeight } : 'NO BIO';
});
out.paras = await p.evaluate(() => {
  return [...document.querySelectorAll('section [class*="talent"] p, section [class*="talent"] h2, section [class*="talent"] span')].map(e => e.textContent.trim()).filter(t => t).slice(0,10);
});
out.errs = errs.slice(0,5);
console.log(JSON.stringify(out, null, 1));
await b.close();
