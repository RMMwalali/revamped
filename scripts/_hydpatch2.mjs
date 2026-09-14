import http from 'node:http';
import { chromium } from 'playwright';
const ORIGIN = process.argv[2];
const TEST_PAGES = (process.argv[3] || ',').split(',').map((s) => s.trim()).filter(Boolean);
const get = (url) => new Promise((resl, rej) => {
  http.get(url, (r) => {
    const chunks = [];
    r.on('data', (c) => chunks.push(c));
    r.on('end', () => resl({ status: r.statusCode, buf: Buffer.concat(chunks) }));
  }).on('error', rej);
});
const CHUNKS = ['vendors-15492f81-3ef867eae466030f.js', 'vendors-27f02048-35cd5d9d69cc457f.js'];
const REPLA = [
  ['b.default.hydrateRoot(E,x,{onRecoverableError:q.onRecoverableError})', 'b.default.createRoot(E).render(x)'],
  ['l.default.hydrateRoot(O,r,{...U,formState:E})', 'l.default.createRoot(O).render(r)'],
];
const browser = await chromium.launch();
for (const pg of TEST_PAGES) {
  const page = await browser.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERR: ' + (e.message || '').slice(0, 160)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('Failed to load resource') && !t.includes('cookie banner')) logs.push('CONSOLE: ' + t.slice(0, 160)); });
  await page.route('**/_next/static/chunks/**', async (route) => {
    const f = new URL(route.request().url()).pathname.split('/').pop();
    if (!CHUNKS.includes(f)) return route.continue();
    const r = await get(ORIGIN + '/assets/root/_next/static/chunks/' + f);
    let s = r.buf.toString('utf8');
    let n = 0;
    for (const [a, b] of REPLA) { if (s.includes(a)) { s = s.split(a).join(b); n++; } }
    logs.push('MANGLE ' + f + ' count=' + n);
    route.fulfill({ status: 200, contentType: 'text/javascript', body: s });
  });
  try {
    await page.goto(ORIGIN + pg, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    const info = await page.evaluate(() => ({
      title: document.title,
      bodyLen: document.body ? document.body.innerText.length : 0,
      hasErrorOverlay: !!(document.querySelector('nextjs-portal') || (document.body.innerText || '').includes('Application error')),
    }));
    console.log(pg, JSON.stringify({ ...info, logs }));
  } catch (e) { console.log(pg, 'LOADFAIL', (e.message || '').slice(0, 120)); }
  await page.close();
}
await browser.close();