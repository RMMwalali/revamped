import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
// Find the Highlight projects section
const sec = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => ({ t: (h.innerText||'').replace(/\s+/g,' ').trim().slice(0,120), cls: h.className.slice(0,40) }));
  return heads;
});
console.log('HEADINGS:');
console.log(JSON.stringify(sec, null, 1).slice(0, 3000));
// Capture all prominents/project titles and excerpts
const cards = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('a[href*="/project/"], a[href*="/projects/"]').forEach(a => {
    const t = (a.innerText||'').replace(/\s+/g,' ').trim();
    const cls = a.className || '';
    if (t || cls) out.push({ href: a.getAttribute('href'), t: t.slice(0,100), cls: String(cls).slice(0,40) });
  });
  return out.slice(0, 40);
});
console.log('\nPROJECT LINKS:');
console.log(JSON.stringify(cards, null, 1).slice(0, 4000));
await browser.close();