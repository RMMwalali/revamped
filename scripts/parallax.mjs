import { chromium } from 'playwright';

async function inspect(url, name) {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  const d = await p.evaluate(() => {
    const out = { bodyH: document.body.scrollHeight };
    const boxes = [...document.querySelectorAll('.styles_parallaxBox__19SzL')];
    out.boxCount = boxes.length;
    out.boxes = boxes.map((el, i) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const section = el.querySelector('.styles_section__VRl4k');
      const footer = el.querySelector('footer');
      return {
        i,
        tag: el.tagName, cls: (el.className || '').toString().slice(0, 50),
        top: Math.round(r.top + scrollY), h: Math.round(r.height),
        position: cs.position, overflow: cs.overflow,
        hasFooter: !!footer,
        sectionH: section ? Math.round(section.getBoundingClientRect().height) : null,
        sectionPos: section ? getComputedStyle(section).position : null,
        footerH: footer ? Math.round(footer.getBoundingClientRect().height) : null,
      };
    });
    const q = document.querySelector('.styles_quotecontact__ydy1_');
    if (q) {
      const r = q.getBoundingClientRect();
      out.quote = { top: Math.round(r.top + scrollY), h: Math.round(r.height), pos: getComputedStyle(q).position };
    }
    return out;
  });
  console.log(`[${name}]`, JSON.stringify(d, null, 1));
  await b.close();
}

await inspect('http://127.0.0.1:3000', 'LOCAL');
await inspect('https://iventions.com', 'ORIG');
