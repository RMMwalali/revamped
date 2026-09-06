import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

async function check(url, shot) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const bad = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('response', r => { if (r.status() >= 400) bad.push(`[${r.status()}] ${r.url().slice(0, 140)}`); });
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(6000);
  // scroll through to trigger lazy/animation sections
  for (let i = 1; i <= 12; i++) {
    await page.evaluate((f) => window.scrollTo(0, f * document.body.scrollHeight), i / 12);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const cs = h1 ? getComputedStyle(h1) : null;
    const imgs = [...document.querySelectorAll('img')];
    const errPage = document.body.innerText.includes('Application error');
    return {
      title: document.title,
      bodyH: document.body.scrollHeight,
      h1: h1 ? h1.textContent.trim().slice(0, 100) : null,
      h1fs: cs?.fontSize, h1color: cs?.color,
      imgTotal: imgs.length,
      imgBroken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
      appError: errPage,
    };
  });
  await page.screenshot({ path: shot, fullPage: false });
  console.log(`\n== ${url} ==`);
  console.log('INFO:', JSON.stringify(info));
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 8), null, 1));
  console.log('BAD:', JSON.stringify([...new Set(bad)].slice(0, 12), null, 1));
  await page.close();
}

await check('http://127.0.0.1:3000/', 'clone-home.png');
await check('http://127.0.0.1:3000/service/events', 'clone-events.png');
await browser.close();
console.log('\nDONE verify3');
