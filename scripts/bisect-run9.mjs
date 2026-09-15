import { chromium } from 'playwright';
const norm = (s) => s.replace(/\s+/g, ' ');
const browser = await chromium.launch();
for (const [s, wants, nots] of [
  ['ins-home', ['CPHI Trade Show 2026 TEST TITLE', 'StillCraft London Hub TEST'], ['marketing-and-events']],
  ['ins-insights', ['CPHI Trade Show 2026 TEST TITLE', 'StillCraft London Hub TEST'], ['marketing-and-events']],
  ['ins-detail', ['CPHI Trade Show 2026 TEST TITLE'], []],
]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let failed = '';
  page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 160); });
  await page.goto(`http://127.0.0.1:3459/_bisect-${s}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
  });
  await page.waitForTimeout(2000);
  const txt = norm(await page.evaluate(() => document.body.innerText));
  const bad = txt.includes('Application error') || /Connection closed/.test(failed);
  const wres = wants.map((w) => `${txt.includes(w) ? 'Y' : 'N'}:${w.slice(0, 22)}`).join(' ');
  const nres = nots.map((w) => `${txt.includes(w) ? 'STILL-HERE!' : 'gone-ok'}`).join(' ');
  console.log(s, bad ? 'BROKEN' : 'ok', '|', wres, nres, failed ? ('| ' + failed.slice(0, 100)) : '');
  await page.close();
}
await browser.close();
