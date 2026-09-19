import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 3000 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(10000);
await page.screenshot({ path: 'C:/Users/SERENI~1/AppData/Local/Temp/opencode/home-full.png', fullPage: true });
const scr = await page.evaluate(() => document.body.scrollHeight);
console.log('h', scr);
// also check the /home/ route
await page.goto('http://localhost:3000/home', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
await page.screenshot({ path: 'C:/Users/SERENI~1/AppData/Local/Temp/opencode/home2-full.png', fullPage: true });
const txt = await page.evaluate(() => document.body.innerText);
console.log('HAS INSIDE:', txt.includes('Inside'), 'HAS 05.03.26:', txt.includes('05.03.26'), 'HAS London hub:', txt.toLowerCase().includes('london hub'));
await browser.close();