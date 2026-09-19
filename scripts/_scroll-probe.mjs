import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function capture(base, label) {
  const errs = [];
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  const seen = new Set();
  page.on('pageerror', e => { const k = (e.message || '').slice(0, 120); if (!seen.has(k)) { seen.add(k); errs.push('PAGERR ' + (e.stack || e.message || '').slice(0, 400)); } });
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); const k = t.slice(0, 120); if (!seen.has(k) && !/\bfavicon|ERR_BLOCKED_BY_CLIENT/.test(t)) { seen.add(k); errs.push('CONSOLE ' + t.slice(0, 250)); } } });

  await page.goto(base, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000 placeholderCheck());
  await page.waitForTimeout(6000);
  const out = { base, errs };
  // find the section after stats
  const info = await page.evaluate(() => {
    const res = { statsY: -1, caseSection: null, cards: [] };
    const st = [...document.querySelectorAll('section')];
    const stats = st.find(s => /[0-9]+(?:\.[0-9]+)?[KMBk]?[\s\S]{0,80}(projects|events|works)/i.test(s.innerText || '') && /GOT A PROJECT/i.test(s.innerText || ''));
    return res;
  });
  return out;
}
console.log('(placeholder)');
await browser.close();