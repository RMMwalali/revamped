import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://127.0.0.1:3000', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

// Check key visual elements
const audit = await page.evaluate(() => {
  const out = {};
  const q = (s) => document.querySelector(s);

  // hero h1
  const h1 = q('h1');
  if (h1) {
    const c = getComputedStyle(h1);
    out.hero_h1 = {
      fontSize: c.fontSize, lineHeight: c.lineHeight, fontWeight: c.fontWeight,
      letterSpacing: c.letterSpacing, color: c.color, font: c.fontFamily,
      textTransform: c.textTransform, textAlign: c.textAlign
    };
    const r = h1.getBoundingClientRect();
    out.hero_h1_box = { x: r.x, y: r.y, w: r.width, h: r.height };
  }

  // hero section background - body bg
  out.body_bg = getComputedStyle(document.body).backgroundColor;
  out.html_fontsize = getComputedStyle(document.documentElement).fontSize;

  // header/menu button
  const menuBtn = q('header button, [aria-label="menu button"]');
  if (menuBtn) {
    const c = getComputedStyle(menuBtn);
    out.menu_btn = { bg: c.backgroundColor, color: c.color, fontSize: c.fontSize, pos: c.position };
  }

  // logo figure
  const logo = q('figure img[alt="logo"]');
  if (logo) {
    const c = getComputedStyle(logo);
    out.logo_src = logo.getAttribute('src');
    out.logo_loaded = logo.complete;
  }

  // Check all images loaded vs broken
  const imgs = [...document.querySelectorAll('img')];
  const broken = imgs.filter(i => i.complete && i.naturalWidth === 0);
  const loaded = imgs.filter(i => i.complete && i.naturalWidth > 0);
  out.img_total = imgs.length;
  out.img_loaded = loaded.length;
  out.img_broken = broken.length;
  out.img_broken_srcs = broken.slice(0, 10).map(i => i.getAttribute('src') || i.getAttribute('data-src'));

  // Count stylesheets loaded
  out.stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href'));
  out.emotion_styles = document.querySelectorAll('style[data-emotion]').length;

  // Paint check: is anything visible? sample body children visibility
  out.visible_imgs = imgs.filter(i => {
    const st = getComputedStyle(i);
    const r = i.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0;
  }).length;

  return out;
});

console.log(JSON.stringify(audit, null, 2));
await browser.close();
