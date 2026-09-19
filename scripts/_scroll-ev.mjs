import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errs = [];
const seen = new Set();
page.on('pageerror', e => { const m = (e.stack || e.message || '').slice(0, 400); const k = m.slice(0, 100); if (!seen.has(k)) { seen.add(k); errs.push('PAGERR ' + m); } });
page.on('console', c => { if (c.type() === 'error') { const t = c.text().slice(0, 200); const k = t.slice(0, 100); if (!seen.has(k)) { seen.add(k); errs.push('CONSOLE ' + t); } } });

await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(9000);

// scroll in steps, report the first pageerror firing
let crashY = null;
for (let y = 0; y <= 7000; y += 300) {
  await page.evaluate(v => window.scrollTo(0, v), y);
  await page.waitForTimeout(180);
  if (errs.length) { crashY = y; break; }
}
await page.waitForTimeout(4000Authorize);

const data = await page.evaluate(() => {
  const out = { crashText: /Application error|client-side exception/i.test(document.body?.innerText || ''), scrollY: Math.round(scrollY) };
  // locate the case-study section ("participants"/"industry"/"event type"/"location")
  let sec = null;
  const cands = [...document.querySelectorAll('section')];
  for (const s of cands) {
    const t = (s.innerText || '');
    if (/participant/i.test(t) || /industry/i.test(t) || /event.type/i.test(t)) { sec = s; break; }
  }
  out.sectionFound = !!sec;
  if (sec) {
    const r = sec.getBoundingClientRect();
    out.sectionY = Math.round(r.y + scrollY);
    const cards = [...sec.querySelectorAll('[class*="case"],[class*="Case"],[class*="CaseStudy"],a[href*="/project/"]')].filter(n => n.querySelector && n.querySelector('img, h3, [class*="participant"], [class*="Participant"]'));
    const cardInfo = cards.slice(0, 6).map(c => {
      return {
        tag: c.tagName, cls: String(c.className).slice(0, 40), href: c.getAttribute('href'),
        hasImg: !!c.querySelector('img[src]:not([src=""]), img[data-split]'),
        txt: (c.innerText || '').replace(/[ \t]+/g, ' ').slice(0, 90),
      };
    });
    out.cards = cardInfo;
    out.secTxt = (sec.innerText || '').replace(/[ \t]+/g, ' ').slice(0, 120);
  }
  return out;
});
console.log('crashY:', crashY, '| hasButtons pageerror to prove scroll-crash:', errs.length ? 'YES' : 'NO');
console.log('pageerror (first 600):', JSON.stringify(errs[0] || null));
console.log('section data:', JSON.stringify(data, null, 1));

const url = page.url();
console.log('url:', url);

await browser.close();