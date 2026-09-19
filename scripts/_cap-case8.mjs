import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(8000);
const dump = await page.evaluate(() => {
  // find the slide wrapper: each slide has class imageOuter or is inside slider content
  const content = document.querySelector('.styles_content__LLh8c, [class*=content]');
  const slides = [...document.querySelectorAll('img[alt="projects"]')];
  const out = slides.map((img, i) => {
    const parentChain = [];
    let n = img;
    for (let k = 0; k < 8 && n; k++) { n = n.parentElement; if (n) parentChain.push(String(n.className).slice(0, 40)); }
    return { i, src: (img.src || '').slice(-70), parentCls: parentChain };
  });
  // each viewport slide main element: h="100lvh" relative wrappers
  const viewSlides = [];
  document.querySelectorAll('[class*=will-change-transform]').forEach(h => {
    const p = h.parentElement;
  });
  // count h3 titles with class e.g. project-name
  const h3s = [...document.querySelectorAll('h3')].map(h => ({ t: h.innerText, cls: String(h.className).slice(0, 40), y: Math.round(h.getBoundingClientRect().top + scrollY) }));
  return { slides: out, h3s };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();