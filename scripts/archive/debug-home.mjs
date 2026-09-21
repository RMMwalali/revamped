import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => console.log('[console.' + m.type() + ']', m.text().slice(0, 500)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 800)));
page.on('requestfailed', r => console.log('[reqfail]', r.url().slice(0, 140), r.failure()?.errorText));
try {
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => ({
    title: document.title,
    bodyH: document.body.scrollHeight,
    h1: document.querySelector('h1')?.textContent?.slice(0, 60) || null,
    appError: document.body.innerText.includes('Application error'),
    imgs: document.querySelectorAll('img').length,
  }));
  console.log('INFO:', JSON.stringify(info));
  await page.screenshot({ path: 'debug-home.png' });
} catch (e) { console.log('NAVFAIL', e.message.slice(0, 200)); }
await browser.close();
