import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const s of ['safe06']) {
  const page = await browser.newPage();
  let failed = '';
  page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 200); });
  await page.goto(`http://127.0.0.1:3459/_bisect-${s}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 80) : 'NO BODY');
  const bad = body.includes('Application error') || /Connection closed/.test(failed);
  console.log(s, bad ? 'BROKEN' : 'ok', '|', JSON.stringify(body.slice(0, 60)), failed ? ('| ' + failed.slice(0, 150)) : '');
  await page.close();
}
await browser.close();
