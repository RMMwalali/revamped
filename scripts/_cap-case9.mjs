import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  // highlight slider: get textContent + innerHTML of each css-zwnf0y h3 card
  const h3s = [...document.querySelectorAll('h3.css-zwnf0y')].map(h => ({
    textContent: h.textContent.slice(0, 60),
    innerHTML: h.innerHTML.slice(0, 200),
    parent: h.parentElement ? String(h.parentElement.className).slice(0, 40) : '',
  }));
  // events slider: inspect where participants/values live
  const cssZme24x = [...document.querySelectorAll('.css-zme24x')].slice(0, 4).map(n => ({
    textContent: (n.textContent || '').slice(0, 60),
  }));
  return { h3s, cssZme24x };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();