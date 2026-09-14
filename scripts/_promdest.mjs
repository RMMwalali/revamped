import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(6000);
const r = await page.evaluate(() => {
  const html = document.body.innerHTML;
  const i = html.indexOf('easter-at-galleria-mall');
  const out = { where: i };
  if (i >= 0) out.ctx = html.slice(Math.max(0, i - 500), i + 200);
  // find the component that hosts the slides: look for a section containing swiper/slide classes or the first slide title
  for (const k of ['swiper', 'project-home', 'prominent', 'Book the experience', 'View case']) {
    out[k] = html.indexOf(k);
  }
  return out;
});
console.log('ctx:', r.where, '->', JSON.stringify(r.ctx || '').slice(0, 900));
console.log('keys:', JSON.stringify({ swiper: r.swiper, prominent: r.prominent }));
// dump any element mentioning a case title
const titles = await page.evaluate(() => {
  const ts = ['Easter at Galleria', 'Mothers Day at Galleria', 'World Cup Watch Party', 'Christmas Campaign', "Valentine's Day at Sarit"];
  const hits = [];
  for (const t of ts) {
    const els = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').includes(t));
    hits.push(t + ' -> ' + els.length + ' x ' + els.slice(0, 2).map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 40)).join(' | '));
  }
  return hits;
});
console.log('case title occurrences:'); for (const t of titles) console.log('  ', t);
await browser.close();