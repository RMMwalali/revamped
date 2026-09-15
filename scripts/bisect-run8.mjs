import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const s of ['v1-reorder', 'v2-title']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let failed = '';
  page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 160); });
  await page.goto(`http://127.0.0.1:3459/_bisect-${s}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  // scroll through the page to trigger lazy sections
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(3000);
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/insight/"]')].map((a) => a.getAttribute('href')));
  const txt = await page.evaluate(() => document.body.innerText);
  console.log(s, '| links:', links.join(','), '| newtitle:', txt.includes('CPHI Trade Show 2026 TEST TITLE') ? 'YES' : 'no', failed ? ('| ' + failed.slice(0, 100)) : '');
  await page.close();
}
await browser.close();
