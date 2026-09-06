import { chromium } from 'playwright';
async function footer(url, name) {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(2500);
  const d = await p.evaluate(() => {
    const f = document.querySelector('footer');
    if (!f) return { found: false };
    const r = f.getBoundingClientRect();
    const children = [...f.children].map(c => ({
      h: Math.round(c.getBoundingClientRect().height),
      cls: (c.className || '').toString().slice(0, 40),
      txt: (c.textContent || '').slice(0, 30).replace(/\s+/g, ' ')
    }));
    return { found: true, footerH: Math.round(r.height), offsetTop: Math.round(r.top + scrollY), children };
  });
  console.log(`[${name}]`, JSON.stringify(d, null, 1));
  await b.close();
}
await footer('http://127.0.0.1:3000', 'LOCAL');
await footer('https://iventions.com', 'ORIG');
