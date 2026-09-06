import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
try {
  await page.goto('https://iventions.com/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => ({
    title: document.title,
    bodyH: document.body.scrollHeight,
    h1: document.querySelector('h1')?.textContent?.slice(0, 60) || null,
    appError: document.body.innerText.includes('Application error'),
  }));
  console.log('LIVE INFO:', JSON.stringify(info));
  await page.screenshot({ path: 'debug-live.png' });
} catch (e) { console.log('NAVFAIL', e.message.slice(0, 200)); }
await browser.close();
