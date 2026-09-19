import { chromium } from 'playwright';
import { copyFile } from 'node:fs/promises';

const browser = await chromium.launch();
const base = String.raw`C:\Users\SERENI~1\AppData\Local\Temp\opencode\fullraw`;
const steps = 'C:/BACKUPS/STILLLCRAFT/dist/_steps';

async function testStep(label, file) {
  try { await copyFile(file, base + '\\index.html'); } catch (e) { console.log(label, 'copy err', e.message); return; }
  const page = await browser.newPage();
  let err = null;
  page.on('pageerror', e => { if (!err) err = (e.message || '').slice(0, 220); });
  await page.goto('http://localhost:3125/', { waitUntil: 'load', timeout: 60000 }).catch(e => { err = 'goto ' + e.message; });
  await page.waitForTimeout(4000);
  const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 40) : '(no body)');
  const ok = body.startsWith('MENU');
  console.log(`${label.padEnd(28)} ${ok ? 'OK     ' : 'FAILED '} ${body.replace(/\n/g, '|').slice(0, 56)}${err ? '   ERR: ' + err : ''}`);
  await page.close();
}

await testStep('00-RAW', 'C:/BACKUPS/STILLLCRAFT/dist/index.html');
for (let i = 1; i <= 34; i++) {
  const name = String(i).padStart(2, '0');
  const fs = await import('node:fs');
  const files = fs.readdirSync(steps);
  const f = files.find(x => x.startsWith(name + '-'));
  if (!f) continue;
  await testStep(f.replace('.html', ''), `${steps}/${f}`);
}
await browser.close();