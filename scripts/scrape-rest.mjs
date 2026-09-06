import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://iventions.com';
const ROUTES = [
  'insight/10-tactics-to-treat-vip-guests-right',
  'insight/an-event-management-companys-guide-to-going-green',
  'insight/choosing-an-event-management-company',
  'insight/choosing-exhibition-builders',
  'insight/cphi-trade-show',
  'insight/destination-management-companies-explained-from-local-expertise-to-global-impact',
  'insight/do-you-need-an-international-event-agency',
  'insight/full-service-experiential-agency-vs-creative-boutique',
  'insight/hottest-event-tech-trends',
  'insight/how-do-you-repeat-world-class-sports-events-across-cities',
  'insight/ibc-trade-show',
  'insight/ifa-trade-show',
  'insight/iventions-awarded-with-website-of-the-month',
  'insight/iventions-but-bolder',
  'insight/iventions-london-hub',
  'insight/iventions-recognised-as-a-great-place-to-work',
  'insight/marketing-and-events',
  'insight/mwc-2026-how-to-guide',
  'insight/starting-every-big-project-with-a-whole-team-brainstorm',
  'insight/the-future-of-virtual-events-in-corporate-environments',
  'insight/the-role-of-event-production-in-high-impact-corporate-events',
  'insight/using-event-photography-to-amplify-post-event-marketing',
  'project/adidas-display-wall',
  'project/uefa-champions-league-final-2026',
  'project/ypo-global-event',
  'projects/all',
  'projects/congresses',
  'projects/events',
  'projects/exhibits',
  'projects/sports',
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
    await page.goto(ORIGIN + '/' + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForFunction(() => document.querySelectorAll('h1,h2,h3,h4').length > 0, { timeout: 20000 });
    } catch {}
    await page.waitForTimeout(2000);
    await scrollThrough(page);
    const html = await page.content();
    const dest = path.join('scraped', route, 'index.html');
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html, 'utf8');
    console.log(`Scraped /${route} (${html.length} chars)`);
  } catch (e) {
    console.log(`FAILED /${route}: ${e.message.slice(0, 120)}`);
  }
  await page.close();
}
await browser.close();
console.log('DONE scrape-rest');
