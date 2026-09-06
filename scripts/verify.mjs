import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

// 1) Serve local clone via file check + screenshot
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('requestfailed', r => errors.push('REQFAIL ' + r.url()));

await page.goto('http://127.0.0.1:3000', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 600) : '(no body)');
console.log('BODY TEXT HEAD:', JSON.stringify(text.slice(0, 300)));

const h1 = await page.evaluate(() => {
  const h = document.querySelector('h1');
  const computed = h ? getComputedStyle(h) : null;
  return {
    exists: !!h,
    text: h ? h.textContent : null,
    color: computed ? computed.color : null,
    fontSize: computed ? computed.fontSize : null,
    fontFamily: computed ? computed.fontFamily : null,
    visibility: computed ? computed.visibility : null,
    display: computed ? computed.display : null
  };
});
console.log('H1:', JSON.stringify(h1));

const heroBox = await page.evaluate(() => {
  const el = document.querySelector('main') || document.body;
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
console.log('main box:', JSON.stringify(heroBox));

const mainBg = await page.evaluate(() => {
  const el = document.querySelector('main');
  return el ? getComputedStyle(el).backgroundColor : null;
});
console.log('main bg:', mainBg);

console.log('CONSOLE ERRORS:', errors.slice(0, 10));

await page.screenshot({ path: 'clone-shot.png', fullPage: false });
console.log('screenshot saved clone-shot.png');
await browser.close();
