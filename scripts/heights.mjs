import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });

async function sectionHeights(url, name, scrollAll) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(3000);
  if (scrollAll) {
    for (let i = 1; i <= 40; i++) {
      await page.evaluate((f) => scrollTo(0, f * document.body.scrollHeight), i / 40);
      await page.waitForTimeout(80);
    }
  }
  await page.waitForTimeout(1000);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  const data = await page.evaluate((name) => {
    const result = { name, total: document.body.scrollHeight };
    // Find the outermost block divs in main and report their heights/classes
    const main = document.querySelector('main');
    if (main) {
      const children = [...main.children].map((c) => ({
        cls: (c.className || '').toString().slice(0, 60),
        tag: c.tagName,
        h: Math.round(c.getBoundingClientRect().height),
        offsetTop: Math.round((c.getBoundingClientRect().top + window.scrollY)),
      }));
      result.mainChildren = children;
    }
    // Check for GSAP pin-spacer
    result.pinSpacers = document.querySelectorAll('.pin-spacer').length;
    result.dataLenin = document.querySelectorAll('html[data-lenis]').length;
    return result;
  }, name);
  console.log(`[${name}] total=${data.total} pinspacer=${data.pinSpacers}`);
  if (data.mainChildren) {
    for (const c of data.mainChildren) {
      console.log(`   <${c.tag}> ${c.cls}  h=${c.h} top=${c.offsetTop}`);
    }
  }
  await page.close();
}

await sectionHeights('http://127.0.0.1:3000', 'LOCAL', true);
await sectionHeights('https://iventions.com', 'ORIG', true);
await browser.close();
