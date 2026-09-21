import {chromium} from 'playwright';
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
await page.goto('http://127.0.0.1:3105/', {waitUntil: 'load', timeout: 60000});
await page.waitForTimeout(8000);
const cards = await page.evaluate(() => [...document.querySelectorAll('h4.css-hj2ayb')].map(h => {
  const card = h.closest('a') || h.parentElement;
  const a = h.closest('a[title]') || document.evaluate('following::a[@title][1]', h, null, 9, null).singleNodeValue;
  return {h4: h.textContent.trim().slice(0, 40), link: a ? (a.getAttribute('title') + ' -> ' + a.getAttribute('href')) : null};
}));
console.log(JSON.stringify(cards, null, 1));
await browser.close();
