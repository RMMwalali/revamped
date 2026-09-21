import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:3105/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);
  const cards = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('h4').forEach((h) => {
      if (/hj2ayb/.test(h.className || '') || /woo/i.test(h.className || '')) out.push(h.textContent.trim());
    });
    return out;
  });
  const nav = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.textContent.trim()).filter(t => ['Home','About','Mall and Retail','Mall Space Monetization','Brand Activations','Contact'].includes(t)));
  const c3 = await page.evaluate(() => {
    const hs = Array.from(document.querySelectorAll('h4')).filter(h => /hj2ayb/.test(h.className||''));
    return hs.map(h => h.textContent.trim());
  });
  const title = await page.title();
  console.log('CARDS(hydrated):', JSON.stringify(c3));
  console.log('NAV(hydrated):', JSON.stringify(nav));
  console.log('TITLE:', title);
  console.log('has Application error:', /Application error/.test(await page.content()));
  console.log('console errors:', logs.filter(l => /error|Exception/i.test(l)).slice(0,5));
  await browser.close();
})();