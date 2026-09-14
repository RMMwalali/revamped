import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const out = { slugs: 0, buttons: [], links: [], onclicks: [] };
  const html = document.body.innerHTML;
  out.slugs = (html.match(/easter-at-galleria-mall/g) || []).length;
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (h.includes('project')) out.links.push(h);
  }
  for (const b of [...document.querySelectorAll('button, [role="link"], [data-testid], .swiper-slide, a')]) {
    const t = (b.textContent || '').trim().slice(0, 40);
    if (t && (t.includes('Easter') || t.includes('Mothers') || t.includes('World Cup') || t.includes('Christmas') || t.includes('Valentine'))) {
      out.buttons.push({ tag: b.tagName, text: t, cls: (b.className || '').toString().slice(0, 60), href: b.getAttribute ? b.getAttribute('href') : null });
    }
  }
  return out;
});
console.log('slug occurrences:', info.slugs);
console.log('project links:', JSON.stringify(info.links.slice(0, 6)));
console.log('buttons w/ mall names:', JSON.stringify(info.buttons.slice(0, 8), null, 1));
await browser.close();