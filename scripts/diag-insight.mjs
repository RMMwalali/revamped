import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:3458/insight/iventions-london-hub';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 500)); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e && e.message || e).slice(0, 800)));
await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch((e) => errors.push('[goto] ' + String(e).slice(0, 300)));
await page.waitForTimeout(6000);
const bodyText = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 200) : 'NO BODY');
console.log('BODY:', JSON.stringify(bodyText));
console.log('TITLE:', await page.title());
console.log('ERRORS:', errors.length);
errors.slice(0, 8).forEach((e) => console.log(e));
await browser.close();
