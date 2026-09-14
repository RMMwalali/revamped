import http from 'node:http';
import { chromium } from 'playwright';
const ORIGIN = process.argv[2];           // e.g. http://127.0.0.1:8087
const TARGET = process.argv[3] || ORIGIN;  // same
const TEST_PAGES = (process.argv[4] || ',').split(',').map((s) => s.trim()).filter(Boolean);
const get = (url) => new Promise((resl, rej) => {
  http.get(url, (r) => {
    const chunks = [];
    r.on('data', (c) => chunks.push(c));
    r.on('end', () => resl({ status: r.statusCode, ct: r.headers['content-type'] || '', buf: Buffer.concat(chunks) }));
  }).on('error', rej);
});
const VENDOR = 'vendors-17046ce7-1c51721bf7671b66.js';
const browser = await chromium.launch();
for (const pg of TEST_PAGES) {
  const page = await browser.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERR: ' + (e.message || '').slice(0, 160)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('Failed to load resource') && !t.includes('cookie banner')) logs.push('CONSOLE: ' + t.slice(0, 160)); if (t.includes('SC-PATCH')) logs.push('MARKER: ' + t.slice(0, 40)); });
  await page.route('**/_next/static/chunks/' + VENDOR + '**', async (route) => {
    const r = await get(ORIGIN + '/assets/root/_next/static/chunks/' + VENDOR);
    let s = r.buf.toString('utf8');
    const needle = 'n.hydrateRoot=function(e,n,t){if(!s(e))throw Error(i(299));';
    if (s.includes(needle)) {
      const wrap = 'n.hydrateRoot=function(e,n,t){var __cr=n.createRoot?n.createRoot(e):null;if(__cr){__cr.render(n);return{render:function(){},_unstable_scheduleHydration:function(){}};}if(!s(e))throw Error(i(299));';
      s = s.split(needle).join(wrap);
      s = 'console.log("SC-PATCH-VENDOR-LIVE");' + s;
      logs.push('PATCHED: yes');
    } else logs.push('PATCHED: NO NEEDLE FOUND');
    route.fulfill({ status: 200, contentType: 'text/javascript', body: s });
  });
  try {
    await page.goto(TARGET + pg, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    const info = await page.evaluate(() => ({
      title: document.title,
      bodyLen: document.body ? document.body.innerText.length : 0,
      h1: [...document.querySelectorAll('h1, h2')].slice(0, 4).map((h) => h.textContent.trim().slice(0, 50)),
      hasErrorOverlay: !!(document.querySelector('nextjs-portal') || (document.body.innerText || '').includes('Application error')),
      links: [...document.querySelectorAll('a[href*="/project/"]')].slice(0, 6).map((a) => a.getAttribute('href')),
    }));
    console.log(pg, JSON.stringify({ ...info, logs }));
  } catch (e) { console.log(pg, 'LOADFAIL', (e.message || '').slice(0, 120)); }
  await page.close();
}
await browser.close();