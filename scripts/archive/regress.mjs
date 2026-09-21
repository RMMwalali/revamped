import { chromium } from 'playwright';
const targets = [
  '/insight/iventions-london-hub',
  '/insight/cphi-trade-show',
  '/insights',
  '/',
  '/about',
  '/service/events',
  '/projects',
  '/contact',
];
const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage();
  const bad404 = [];
  let failed = '';
  page.on('response', (r) => { if (r.status() >= 400) bad404.push(`${r.status()} ${r.url().slice(0, 110)}`); });
  page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 160); });
  await page.goto(`http://127.0.0.1:3458${t}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 60) : 'NO BODY');
  const title = await page.title().catch(() => '');
  const bad = body.includes('Application error') || /Connection closed/.test(failed);
  console.log(t, bad ? 'BROKEN' : 'ok', '|', JSON.stringify(title.slice(0, 60)));
  if (bad) console.log('   ', JSON.stringify(body.slice(0, 80)), failed.slice(0, 150));
  bad404.slice(0, 4).forEach((u) => console.log('   404:', u));
  await page.close();
}
await browser.close();
