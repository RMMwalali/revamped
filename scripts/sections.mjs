import { chromium } from 'playwright';
async function sections(url, name) {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { window.ScrollTrigger && window.ScrollTrigger.refresh(); } catch (e) {} });
  await p.waitForTimeout(500);
  const d = await p.evaluate(() => {
    const out = { name: null, total: document.body.scrollHeight };
    out.secs = [...document.querySelectorAll('main>div')].map(c => ({
      h: Math.round(c.getBoundingClientRect().height),
      top: Math.round(c.getBoundingClientRect().top + scrollY),
      txt: (c.textContent || '').slice(0, 28).replace(/\n/g, ' ')
    }));
    return out;
  });
  d.name = name;
  console.log(`[${name}] total=${d.total}`);
  d.secs.forEach(s => console.log(`   h=${s.h} top=${s.top} :: ${s.txt}`));
  await b.close();
}
await sections('http://127.0.0.1:3000', 'LOCAL');
await sections('https://iventions.com', 'ORIG');
