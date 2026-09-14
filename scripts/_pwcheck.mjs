import { chromium } from 'playwright';
const routes = [
  '/', '/home', '/projects',
  ...['easter-at-galleria-mall', 'mothers-day-at-galleria-mall', 'world-cup-watch-party-at-galleria-mall', 'christmas-at-westgate-mall', 'valentines-at-sarit-centre', 'easter-at-sarit-centre', 'valentines-at-southfield-mall', 'easter-at-southfield-mall', 'mothers-day-at-southfield-mall', 'fathers-day-at-southfield-mall', 'christmas-at-southfield-mall', 'mothers-day-brunch-at-southfield-mall'].map((s) => `/project/${s}`),
];
const browser = await chromium.launch();
let trouble = 0;
for (const r of routes) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  try {
    const resp = await page.goto('http://127.0.0.1:3000' + r, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    const status = resp ? resp.status() : '?';
    // next error overlay marker
    const overlay = await page.locator('nextjs-portal').count().catch(() => 'err');
    const bodyErr = await page.locator('body').innerText().catch(() => '');
    const hasAppErr = /Application error/.test(bodyErr) || /client-side exception/.test(bodyErr);
    if (errs.length || hasAppErr || overlay > 0) {
      trouble++;
      console.log('!!', r, 'status', status, 'errcount', errs.length, 'overlay', overlay, 'apperr', hasAppErr);
      errs.slice(0, 6).forEach((e) => console.log('   ', e));
    } else {
      console.log('ok', r, status);
    }
  } catch (e) {
    trouble++;
    console.log('!! NAV ERROR', r, e.message.split('\n')[0]);
    errs.slice(0, 6).forEach((x) => console.log('   ', x));
  }
  await page.close();
}
console.log(trouble === 0 ? 'NO CLIENT ERRORS' : trouble + ' ROUTES WITH ERRORS');
await browser.close();