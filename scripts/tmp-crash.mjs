import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3000/home';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
} catch (e) {
  logs.push('[goto] ' + e.message);
}
await page.waitForTimeout(3000);
const body = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '');
console.log('URL:', url);
console.log('--- body head ---');
console.log(body);
console.log('--- logs ---');
console.log(logs.join('\n'));
await browser.close();