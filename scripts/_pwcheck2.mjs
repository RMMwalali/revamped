import { chromium } from 'playwright';
const routes = ['/', '/home', '/projects', '/project/easter-at-galleria-mall'];
const browser = await chromium.launch();
for (const r of routes) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PGERR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  const failed = new Set();
  page.on('response', (resp) => { if (resp.status() === 404) failed.add(resp.url()); });
  await page.goto('http://127.0.0.1:3000' + r, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3500);
  const appErr = await page.locator('body').innerText().then((t) => /Application error/.test(t)).catch(() => null);
  console.log((errs.length === 0 && !appErr ? 'ok   ' : '!!!  ') + r);
  errs.slice(0, 4).forEach((e) => console.log('    ', e));
  const f = [...failed].filter((u) => !u.includes('consentcdn.cookiebot.com'));
  console.log('    404s:', f.length ? f.slice(0, 8).join('\n           ') : '(none)');
  await page.close();
}
await browser.close();