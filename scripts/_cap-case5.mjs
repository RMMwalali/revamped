import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  const out = [];
  const target = [...document.querySelectorAll('div,section,article')].filter(n => {
    const t = n.innerText || '';
    return /PARTICIPANTS/.test(t) && t.length < 3000 && n.getBoundingClientRect().top + scrollY > 7000 && n.getBoundingClientRect().top + scrollY < 11500;
  });
  for (const n of target.slice(0, 8)) {
    const imgs = [...n.querySelectorAll('img')].map(i => ({ alt: i.alt, src: (i.src || '').split('?')[0].split('/').slice(-2).join('/') })).slice(0, 3);
    const y = Math.round(n.getBoundingClientRect().top + scrollY);
    out.push({ cls: String(n.className).slice(0, 30), y, text: (n.innerText || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 18), imgs });
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();