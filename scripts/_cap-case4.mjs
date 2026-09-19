import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  // find all h3 with will-change-transform cards (slider slides)
  const out = [];
  document.querySelectorAll('h3.will-change-transform, h3[class*=will-chan]').forEach(h => {
    const y = Math.round(h.getBoundingClientRect().top + scrollY);
    const card = h.closest('.will-change-transform, [class*=will-chan]');
    const img = card ? [...card.querySelectorAll('img')].map(i => (i.src || '').split('?')[0].split('/').slice(-2).join('/')) : [];
    const texts = card ? (card.innerText || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
    const marker = card ? card.getAttribute('data-index') || '' : '';
    out.push({ y, title: h.innerText, marker, img, texts: texts.slice(0, 8) });
  });
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();