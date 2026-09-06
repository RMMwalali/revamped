// Visit every dist page, collect same-origin requests that 404, print them.
import { chromium } from 'playwright';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const OUT = path.resolve('dist');
async function walk(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...await walk(full, rel));
    else if (e.name === 'index.html' && rel !== 'index.html') out.push('/' + rel.replace(/\/index\.html$/, ''));
  }
  return out;
}
const routes = ['/', ...await walk(OUT)];
console.log('routes:', routes.length);

const browser = await chromium.launch({ headless: true });
const failed = new Set();
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('response', r => {
    if (r.status() >= 400) {
      try {
        const u = new URL(r.url());
        if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') failed.add(u.pathname);
      } catch {}
    }
  });
  try {
    await page.goto('http://127.0.0.1:3000' + route, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(4000);
    for (let i = 1; i <= 6; i++) {
      await page.evaluate((f) => window.scrollTo(0, f * document.body.scrollHeight), i / 6);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1500);
  } catch (e) { console.log('NAV FAIL', route, e.message.slice(0, 80)); }
  await page.close();
  console.log('done', route);
}
await browser.close();
const list = [...failed].sort().filter(p => !p.includes('cdn-cgi') && !p.includes('_rsc'));
console.log('\nFAILED SAME-ORIGIN (' + list.length + '):');
for (const f of list) console.log('  ' + f);
await writeFile('missing-assets.txt', list.join('\n') + '\n', 'utf8');
console.log('wrote missing-assets.txt');
