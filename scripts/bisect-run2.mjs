import { chromium } from 'playwright';

const steps = ['f00-raw','f01-slugswap','f02-drop','f03-rename','f04-prepend','f05-reorder','f06-localize','f07-brand'];
const browser = await chromium.launch();
for (const s of steps) {
  const page = await browser.newPage();
  let failed = '';
  page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 120); });
  await page.goto(`http://127.0.0.1:3459/_bisect-${s}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 60) : 'NO BODY');
  const bad = body.includes('Application error') || /Connection closed/.test(failed);
  console.log(s, bad ? 'BROKEN' : 'ok', '|', JSON.stringify(body.slice(0, 50)), failed ? ('| ' + failed.slice(0, 100)) : '');
  await page.close();
}
await browser.close();
