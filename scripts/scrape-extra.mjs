import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://iventions.com';
const ROUTES = [
  { route: '/home', file: 'home/index.html' },
  { route: '/cookie-policy', file: 'cookie-policy/index.html' },
  { route: '/legal-notice-terms-of-use', file: 'legal-notice-terms-of-use/index.html' },
  { route: '/privacy-policy', file: 'privacy-policy/index.html' },
];

const browser = await chromium.launch({ headless: true });

async function scrollThrough(page) {
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((f) => scrollTo(0, f * document.body.scrollHeight), i / steps);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
}

for (const { route, file } of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.includes('cloudflareinsights') || u.includes('googletagmanager') || u.includes('cookiebot') || u.includes('beacon.min.js') || u.includes('gtm.js')) return r.abort();
    return r.continue();
  });
  await page.goto(ORIGIN + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForFunction(() => document.querySelectorAll('h1,h2,h3,h4').length > 0, { timeout: 20000 });
  } catch {}
  await page.waitForTimeout(2500);
  await scrollThrough(page);
  const html = await page.content();
  const dest = path.join('scraped', file);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, html, 'utf8');
  console.log(`Scraped ${route} -> ${dest} (${html.length} chars)`);
  await page.close();
}
await browser.close();
console.log('DONE scrape-extra');
