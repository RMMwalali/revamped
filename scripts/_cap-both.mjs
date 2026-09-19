import { chromium } from 'playwright';
const browserToplaunch = () => chromium.launch();
for (const base of ['http://localhost:3000/', 'http://localhost:3123/']) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push((e.message || '').slice(0, 160)));
  await page.goto(base, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(8000);
  const vis = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button.ProjectSliderActions_icon__5M3_9').forEach((b, i) => {
      const r = b.getBoundingClientRect();
      if (r.width > 3 && r.height > 3) out.push({ i, x: Math.round(r.x), y: Math.round(r.y) });
    });
    return out;
  });
  let navTo = null;
  if (vis.length) {
    const t = vis[0];
    await page.locator('button.ProjectSliderActions_icon__5M3_9').nth(t.i).click({ timeout: 12000 });
    await page.waitForTimeout(3000);
    navTo = page.url();
  }
  console.log(base, '| visibleArrows:', JSON.stringify(vis), '| pageerrors:', JSON.stringify(errs), '| urlAfterClick:', navTo);
  await browser.close();
}