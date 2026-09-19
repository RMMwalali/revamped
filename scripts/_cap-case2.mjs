import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('h3').forEach(h => {
    const y = h.getBoundingClientRect().top + scrollY;
    if (y < 2000 || y > 2600) return;
    let card = h.closest('[class*=will-chan]') || h.parentElement;
    while (card && card.className && !/will-chan/.test(String(card.className)) && card.parentElement) card = card.parentElement;
    const imgs = card ? [...card.querySelectorAll('img')].map(i => ({ alt: i.alt, src: (i.src || '').slice(0, 70), w: i.width, h: i.height })) : [];
    const texts = card ? (card.innerText || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12) : [];
    out.push({ cardCls: String(card.className).slice(0, 60), h3: h.innerText.replace(/\n/g, ' ').slice(0, 40), imgs, texts });
  });
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();