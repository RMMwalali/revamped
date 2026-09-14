import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR STACK:\n' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
page.on('requestfailed', (r) => console.log('REQFAIL:', r.url(), r.failure() && r.failure().errorText));
await page.goto('http://127.0.0.1:3000/projects', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
await browser.close();