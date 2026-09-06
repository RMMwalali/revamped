import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => ({
  bodyH: document.body.scrollHeight,
  h1: document.querySelector('h1')?.textContent?.slice(0, 40) || null,
  appError: document.body.innerText.includes('Application error'),
}));
console.log('MODE', process.env.SC_NONAV ? 'NONAV' : 'FULL', process.env.SC_NOSTRIP ? 'NOSTRIP' : '', JSON.stringify(info));
console.log('pageerrors:', JSON.stringify(errs.slice(0, 4)));
await browser.close();
