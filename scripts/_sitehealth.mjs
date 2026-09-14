import { chromium } from 'playwright';
const base = 'http://127.0.0.1:3000';
const routes = ['/', '/home', '/projects', '/projects/mall-activations', '/about', '/contact', '/insights', '/service/events',
  '/project/easter-at-galleria-mall', '/project/christmas-at-westgate-mall', '/project/valentines-at-sarit-centre', '/project/world-cup-watch-party-at-galleria-mall', '/project/mothers-day-at-galleria-mall', '/project/fathers-day-at-southfield-mall'];
const browser = await chromium.launch();
const results = [];
for (const r of routes) {
  const page = await browser.newPage();
  const errs = [];
  const nf = [];
  page.on('pageerror', (e) => errs.push((e.message || '').slice(0, 120)));
  page.on('response', (res) => { if (res.status() >= 400 && !res.url().includes('cookiebot') && !res.url().includes('sw.js') && !res.url().includes('favicon')) nf.push(res.status() + ' ' + res.url().slice(0, 110)); });
  try {
    const resp = await page.goto(base + r, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3500);
    const state = await page.evaluate(() => ({
      apperr: (document.body.innerText || '').includes('Application error'),
      title: document.title.slice(0, 60),
      imgs: [...document.querySelectorAll('img[data-nimg="1"]')].filter((i) => (i.naturalWidth || 0) === 0).length,
      h1: (document.querySelector('h1') || {}).textContent ? document.querySelector('h1').textContent.trim().slice(0, 40) : null,
    }));
    results.push({ route: r, status: resp ? resp.status() : '?', apperr: state.apperr, errs, nf: nf.slice(0, 3), title: state.title, deadImgs: state.imgs, h1: state.h1 });
  } catch (e) { results.push({ route: r, status: 'NAV FAIL', errs: [(e.message || '').slice(0, 100)] }); }
  await page.close();
}
for (const x of results) console.log(JSON.stringify(x));
await browser.close();