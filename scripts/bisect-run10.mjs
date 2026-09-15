import { chromium } from 'playwright';
const norm = (s) => s.replace(/\s+/g, ' ');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let failed = '';
page.on('pageerror', (e) => { failed += String(e && e.message || e).slice(0, 160); });
await page.goto('http://127.0.0.1:3459/_bisect-ins-add', { waitUntil: 'load', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  const h = document.body.scrollHeight;
  for (let y = 0; y < h; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
});
await page.waitForTimeout(2000);
const txt = norm(await page.evaluate(() => document.body.innerText));
const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/insight/"]')].map((a) => a.getAttribute('href')));
console.log('bad:', txt.includes('Application error') ? 'BROKEN' : 'ok');
console.log('links:', links.join(','));
console.log('cphi new:', txt.includes('CPHI Trade Show 2026 TEST TITLE') ? 'YES' : 'no');
console.log('marketing new:', txt.includes('Marketing And Events TEST') ? 'YES' : 'no');
const dest = await page.evaluate(() => document.querySelector('a[href="/insight/marketing-and-events"]')?.getAttribute('href'));
// click the added card, expect navigation to the real blog (raw static has it)
await page.evaluate(() => document.querySelector('a[href="/insight/marketing-and-events"]')?.scrollIntoView());
await page.waitForTimeout(500);
console.log('added-card href ok:', dest === '/insight/marketing-and-events' ? 'YES' : dest);
if (failed) console.log('errors:', failed.slice(0, 200));
await browser.close();
