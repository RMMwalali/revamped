import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(4000);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/Users/SERENI~1/AppData/Local/Temp/opencode/footer.png' });
console.log(await page.evaluate(() => JSON.stringify(
  [...document.querySelectorAll('footer img, footer svg')].map(e => e.tagName + ' src=' + (e.getAttribute('src') || '').slice(-40) + ' alt=' + (e.getAttribute('alt') || ''))
)));
await browser.close();
