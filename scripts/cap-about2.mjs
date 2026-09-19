import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(8000);
const out = await p.evaluate(() => {
  const sections = [...document.querySelectorAll('section')].filter(s => /talent/i.test(s.className || ''));
  const s = sections[0];
  if (!s) return { found: false };
  const info = {
    found: true,
    className: s.className,
    bg: getComputedStyle(s).backgroundColor,
    rect: { w: s.offsetWidth, h: s.offsetHeight },
  };
  info.cards = [...s.querySelectorAll('.styles_main_cards__3alDv, [class*="styles_main_cards"]')].map(card => {
    if (!card) return null;
    const cs = getComputedStyle(card);
    const h = card.querySelector('h3,h4,h5,h6');
    const p_ = card.querySelector('p');
    const hl = card.classList.toString();
    const nm = (h ? (h.textContent||'').trim().slice(0,40) : '');
    return {
      cls: hl,
      atomic: [...card.querySelectorAll('[class*="atomic"], [class*="num"], [class*="index"], [class*="detail"]')].map(e=>e.className).slice(0,4),
      bg: cs.backgroundColor,
      name: nm,
      hColor: h ? getComputedStyle(h).color : '',
      hSize: h ? getComputedStyle(h).fontSize : '',
      pColor: p_ ? getComputedStyle(p_).color : '',
      pSize: p_ ? getComputedStyle(p_).fontSize : '',
      pText: p_ ? p_.textContent.trim().slice(0,60) : '',
    };
  });
  info.text = s.innerText.slice(0, 1200);
  info.styles = [...s.querySelectorAll('h2,h3,h4,p,span')].slice(0,12).map(e => {
    const cs = getComputedStyle(e);
    return { tag: e.tagName, cls: (e.className||'').slice(0,40), txt: e.textContent.trim().slice(0,30), color: cs.color, size: cs.fontSize, bg: cs.backgroundColor };
  });
  return info;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
