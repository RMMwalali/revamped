import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://iventions.com';
const ROUTES = [
  'insight/exhibition-builders-turn-static-spaces-into-smart-experiences',
  'insight/exhibition-stand-construction',
  'insight/international-event-agency-secrets',
  'insight/the-exciting-lives-of-americans-a-journey-through-their-adventures-5-ne1',
  'insight/the-science-behind-a-brand-activation-agency-playbook',
  'projects',
  'projects/congresses/page/1',
  'projects/events/page/1',
  'projects/exhibits/page/1',
  'projects/exhibits/page/2',
  'projects/sports/page/1',
];

const browser = await chromium.launch({ headless: true });
async function scrollThrough(page) {
  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((f) => scrollTo(0, f * document.body.scrollHeight), i / steps);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
}
for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.includes('cloudflareinsights') || u.includes('googletagmanager') || u.includes('cookiebot') || u.includes('beacon.min.js') || u.includes('gtm.js')) return r.abort();
    return r.continue();
  });
  try {
    const resp = await page.goto(ORIGIN + '/' + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`GET /${route} -> ${resp?.status()}`);
    try {
      await page.waitForFunction(() => document.querySelectorAll('h1,h2,h3,h4').length > 0, { timeout: 20000 });
    } catch {}
    await page.waitForTimeout(2000);
    await scrollThrough(page);
    const html = await page.content();
    const dest = path.join('scraped', route, 'index.html');
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html, 'utf8');
    console.log(`  saved (${html.length} chars) title=${JSON.stringify(await page.title())}`);
  } catch (e) {
    console.log(`FAILED /${route}: ${e.message.slice(0, 120)}`);
  }
  await page.close();
}
await browser.close();
console.log('DONE scrape-rest2');
