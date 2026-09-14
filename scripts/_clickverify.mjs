import { chromium } from 'playwright';
const base = 'http://127.0.0.1:3000';
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrs = [];
const consoleErrs = [];
const notFound = [];
page.on('pageerror', (e) => pageErrs.push((e.message || '').slice(0, 200)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('Failed to load resource') && !t.includes('cookie banner') && !t.includes('sw.js')) consoleErrs.push(t.slice(0, 200)); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('cookiebot') && !r.url().includes('linkedin') && !r.url().includes('sw.js')) notFound.push(r.status() + ' ' + r.url()); });
await page.goto(base + '/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
const links = await page.evaluate(() => ({
  caseLinks: [...new Set([...document.querySelectorAll('a[href*="/project/"]')].map((a) => a.getAttribute('href')))].slice(0, 12),
  slides: [...document.querySelectorAll('img')].filter((i) => (i.src || '').includes('uploads')).slice(0, 3).map((i) => i.src.slice(0, 100)),
  title: document.title,
}));
console.log('CASE LINKS:', JSON.stringify(links.caseLinks, null, 0));
console.log('SLIDE IMGS:', links.slides.join('\n        '));
console.log('TITLE:', links.title);
if (links.caseLinks.length) {
  const href = links.caseLinks[0];
  console.log('CLICKING:', href);
  await Promise.all([page.waitForNavigation({ timeout: 20000 }).catch(() => {}), page.click('a[href="' + href + '"]')]);
  await page.waitForTimeout(4000);
  console.log('AFTER CLICK URL:', page.url());
  const after = await page.evaluate(() => ({ title: document.title, hasErr: (document.body.innerText || '').includes('Application error'), h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).slice(0, 2) }));
  console.log('AFTER:', JSON.stringify(after));
}
console.log('PAGEERRS:', pageErrs.length ? pageErrs : 'none');
console.log('CONSOLEERRS:', consoleErrs.length ? consoleErrs : 'none');
console.log('ANY 4xx/5xx:', notFound.length ? notFound : 'none');
await browser.close();