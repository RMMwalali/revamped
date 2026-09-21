import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const s of ['ins-home', 'ins-insights', 'ins-detail']) {
  const page = await browser.newPage();
  let failed = '';
  page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 160); });
  await page.goto(`http://127.0.0.1:3459/_bisect-${s}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 60) : 'NO BODY');
  const bad = body.includes('Application error') || /Connection closed/.test(failed);
  const txt = await page.evaluate(() => document.body.innerText);
  const order = ['CPHI Trade Show 2026 TEST TITLE', 'StillCraft London Hub TEST'].map((t) => txt.indexOf(t));
  console.log(s, bad ? 'BROKEN' : 'ok', '| cphi@' + order[0], 'hub@' + order[1], '| hidden-present:', txt.includes('marketing-and-events') ? 'YES?' : 'no', failed ? ('| ' + failed.slice(0, 120)) : '');
  await page.close();
}
await browser.close();
