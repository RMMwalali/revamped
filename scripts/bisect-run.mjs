import { chromium } from 'playwright';

const steps = ['00-raw','01-strip','02-brand','03-nav','04-dboverride','05-fileitems','06-swaps','07-hero','08-cms','09-footer','10-flight','11-team','12-style','13-imgdims','14-splash','15-footerfix'];
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
