import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [s, check] of [
  ['v1-reorder', 'cphi slug first'],
  ['v2-title', 'new title'],
  ['v3-hide', 'hidden gone'],
]) {
  const page = await browser.newPage();
  let failed = '';
  page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 160); });
  await page.goto(`http://127.0.0.1:3459/_bisect-${s}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const txt = await page.evaluate(() => document.body.innerText);
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/insight/"]')].map((a) => a.getAttribute('href')));
  const bad = txt.includes('Application error') || /Connection closed/.test(failed);
  console.log(s, bad ? 'BROKEN' : 'ok',
    '| links:', links.slice(0, 5).join(','),
    '| newtitle:', txt.includes('CPHI Trade Show 2026 TEST TITLE') ? 'YES' : 'no',
    failed ? ('| ' + failed.slice(0, 120)) : '');
  await page.close();
}
await browser.close();
