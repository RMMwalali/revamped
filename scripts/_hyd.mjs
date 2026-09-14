import { chromium } from 'playwright';
const base = process.argv[2];
const pages = process.argv.slice(3);
const browser = await chromium.launch();
for (const pg of pages) {
  const page = await browser.newPage();
  const logs = [];
  page.on('pageerror', (e) => { const m = (e.message || ''); if (m.includes('#418')) logs.push('PAGEERR-418'); else logs.push('PAGEERR: ' + m.slice(0, 120)); });
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('Failed to load resource') && !t.includes('cookie banner') && !t.includes('sw.js') && !t.includes('unsupported MIME'))
      logs.push('CONSOLE: ' + t.slice(0, 120));
  });
  try {
    await page.goto(base + pg, { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2500);
    const h1 = await page.evaluate(() => { const el = document.querySelector('.nextra-breadcrumb,main,h1,[data-testid]'); return document.title; }).catch(() => '?');
    console.log((base.includes('8089') ? 'PRISTINE' : 'REWIRED') + ' ' + pg + ' => ' + (logs.join(' | ') || 'CLEAN'));
  } catch (e) { console.log((base.includes('8089') ? 'PRISTINE' : 'REWIRED') + ' ' + pg + ' => LOADFAIL ' + (e.message || '').slice(0, 80)); }
  await page.close();
}
await browser.close();