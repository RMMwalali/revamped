import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);
const html = await page.evaluate(() => {
  const el = document.querySelector('.styles_content__T0TRn');
  if (!el) return 'not-found';
  return el.parentElement ? el.parentElement.outerHTML.slice(0, 6000) : el.outerHTML.slice(0, 6000);
});
console.log(html);
await browser.close();