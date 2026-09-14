import { chromium } from 'playwright';
const base = 'http://127.0.0.1:3000';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
const reqs = [];
page.on('request', (r) => { if (r.url().includes('_rsc') || r.headers().rsc || r.url().includes('/project')) reqs.push('REQ ' + r.method() + ' ' + r.url()); });
page.on('response', (r) => { if (r.url().includes('_rsc') || r.url().includes('/project')) reqs.push('RES ' + r.status() + ' ' + r.url().slice(0, 130) + ' ct=' + (r.headers()['content-type'] || '')); });
page.on('pageerror', (e) => logs.push('PAGEERR: ' + (e.message || '').slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource') && !m.text().includes('cookie banner')) logs.push('CONSOLE: ' + m.text().slice(0, 200)); });
await page.goto(base + '/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);
const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href*="/project/"],a[href*="/projects"]')].map((a) => a.getAttribute('href')).filter(Boolean).slice(0, 40));
console.log('LINKS:', JSON.stringify(hrefs, null, 0));
const first = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a[href*="/project/"]')].find((x) => x.offsetParent !== null);
  if (!a) return null;
  a.scrollIntoView();
  return a.getAttribute('href');
});
console.log('CLICKING:', first);
if (first) {
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('a[href="' + first + '"]'),
  ]);
}
await page.waitForTimeout(4000);
console.log('FINAL URL:', page.url());
console.log('BODY SNIPPET:', (await page.evaluate(() => document.body ? document.body.innerText.slice(0, 140) : '')).replace(/\n+/g, ' | '));
console.log('\nREQS:'); for (const r of reqs) console.log('  ' + r);
console.log('\nLOGS:'); for (const l of logs) console.log('  ' + l);
await browser.close();