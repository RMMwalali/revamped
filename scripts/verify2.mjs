import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const failed = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('requestfailed', r => failed.push(r.url().slice(0, 160)));
page.on('response', r => { if (r.status() >= 400) failed.push(`[${r.status()}] ${r.url().slice(0, 150)}`); });

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const h1 = document.querySelector('h1');
  const cs = h1 ? getComputedStyle(h1) : null;
  const imgs = [...document.querySelectorAll('img')];
  return {
    title: document.title,
    bodyH: document.body.scrollHeight,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    h1text: h1 ? h1.textContent.slice(0, 120) : null,
    h1fs: cs?.fontSize, h1ff: cs?.fontFamily?.slice(0, 80), h1color: cs?.color,
    imgTotal: imgs.length,
    imgBroken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
    brokenSrcs: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => (i.currentSrc || i.src).slice(0, 120)).slice(0, 10),
    hydrated: !!document.querySelector('[data-nextjs-scroll-focus-boundary]') || !!window.next,
    nextRoot: !!document.getElementById('__next'),
  };
});
console.log('INFO:', JSON.stringify(info, null, 1));
console.log('CONSOLE ERRORS:', JSON.stringify(errors.slice(0, 12), null, 1));
console.log('FAILED REQ:', JSON.stringify([...new Set(failed)].slice(0, 20), null, 1));
await page.screenshot({ path: 'clone-shot.png', fullPage: false });
console.log('screenshot saved');
await browser.close();
