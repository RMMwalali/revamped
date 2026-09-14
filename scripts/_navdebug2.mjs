import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  window.__probe = { down: 0, click: 0 };
  document.addEventListener('pointerdown', () => window.__probe.down++, true);
  document.addEventListener('click', () => window.__probe.click++, true);
});
const loc = page.locator('img[data-nimg="1"]').filter({ hasText: '' }).nth(0);
const uefa = page.locator('img[src*="UEFA"]').first();
console.log('uefa count:', await uefa.count(), '| visible:', await uefa.isVisible().catch(() => '?'));
try {
  await uefa.click({ timeout: 8000, force: true });
} catch (e) { console.log('click threw:', e.message.slice(0, 120)); }
await page.waitForTimeout(3000);
console.log('url:', page.url());
console.log('probe:', await page.evaluate(() => JSON.stringify(window.__probe)));
await browser.close();