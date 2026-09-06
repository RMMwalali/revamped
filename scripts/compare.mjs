import { chromium } from 'playwright';

// Compare local clone vs live original: layout metrics + screenshot pixel diff
const browser = await chromium.launch({ headless: true });

async function capture(url, name) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Scroll through to load lazy content
  await page.goto(url, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(3000);
  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((f) => scrollTo(0, f * document.body.scrollHeight), i / steps);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const body = document.body;
    const select = (s) => document.querySelector(s);
    const style = (el) => (el ? getComputedStyle(el) : null);

    const heroText = select('[data-nimg="fill"]') || select('h1');
    const out = {
      title: document.title,
      bodyScrollH: document.body.scrollHeight,
      bodyBg: style(body)?.backgroundColor,
      h1: (() => {
        const h = select('h1');
        return h ? { t: h.textContent, fs: getComputedStyle(h).fontSize, ff: getComputedStyle(h).fontFamily, color: getComputedStyle(h).color } : null;
      })(),
      menuBtnBg: (() => {
        const b = select('header button, [aria-label="menu button"]');
        return b ? getComputedStyle(b).backgroundColor : null;
      })(),
      imgTotal: document.querySelectorAll('img').length,
      imgBroken: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length,
      navLinks: [...document.querySelectorAll('header li a, .styles_menus a')].map(a=>a.textContent.trim()).filter(Boolean).slice(0,10),
    };
    return out;
  });

  await page.screenshot({ path: name + '.png', fullPage: false });
  console.log(`[${name}]`, JSON.stringify(metrics));
  await page.close();
  return metrics;
}

const local = await capture('http://127.0.0.1:3000', 'cmp-local');
const orig = await capture('https://iventions.com', 'cmp-original');

console.log('\n=== COMPARISON ===');
for (const k of ['title','bodyScrollH','bodyBg','menuBtnBg','imgTotal','imgBroken']) {
  console.log(`  ${k}: local=${JSON.stringify(local[k])}  orig=${JSON.stringify(orig[k])}`);
}
console.log('  h1 local:', JSON.stringify(local.h1));
console.log('  h1 orig :', JSON.stringify(orig.h1));
console.log('  nav local:', JSON.stringify(local.navLinks));
console.log('  nav orig :', JSON.stringify(orig.navLinks));

await browser.close();
