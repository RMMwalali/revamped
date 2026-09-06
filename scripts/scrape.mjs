import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://iventions.com';
const ROUTES = [
  { route: '/', file: 'index.html' },
  { route: '/about', file: 'about/index.html' },
  { route: '/service/events', file: 'service/events/index.html' },
  { route: '/service/exhibits', file: 'service/exhibits/index.html' },
  { route: '/service/congresses', file: 'service/congresses/index.html' },
  { route: '/service/sports', file: 'service/sports/index.html' },
  { route: '/projects/filter', file: 'projects/filter/index.html' },
  { route: '/insights', file: 'insights/index.html' },
  { route: '/contact', file: 'contact/index.html' },
];

const browser = await chromium.launch({ headless: true });

async function scrollThrough(page) {
  // Trigger lazy-loading and 200svh sticky sections by scrolling
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((f) => scrollTo(0, f * document.body.scrollHeight), i / steps);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
}

for (const { route, file } of ROUTES) {
  const url = ORIGIN + (route === '/' ? '/' : route);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Block heavy media/third-party that only slows the crawl
  await page.route('**/*', (r) => {
    const t = r.request().resourceType();
    if (t === 'media' || t === 'image' && r.request().url().includes('beacon')) return r.abort();
    if (r.request().url().includes('cloudflareinsights')
        || r.request().url().includes('googletagmanager')
        || r.request().url().includes('cookiebot')
        || r.request().url().includes('beacon.min.js')
        || r.request().url().includes('gtm.js')) return r.abort();
    return r.continue();
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for the app to hydrate content (h1 or first heading)
  try {
    await page.waitForFunction(() => document.querySelectorAll('h1,h2,h3,h4').length > 0, { timeout: 20000 });
  } catch {}
  await page.waitForTimeout(2500);
  await scrollThrough(page);

  const html = await page.content();
  // Keep links/meta but this will be processed in build step
  const dest = path.join('scraped', file);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, html, 'utf8');
  console.log(`Scraped ${route} -> ${dest} (${html.length} chars)`);
  await page.close();
}

await browser.close();
console.log('DONE scrape');
