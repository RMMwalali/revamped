import { chromium } from 'playwright';
import { copyFile } from 'node:fs/promises';

const base = String.raw`C:\Users\SERENI~1\AppData\Local\Temp\opencode\fullraw`;
const browser = await chromium.launch();
for (const [label, src] of [
  ['s01-facets', 'C:/BACKUPS/STILLLCRAFT/dist/_steps-slice/s01-facets.html'],
  ['s02-quotes', 'C:/BACKUPS/STILLLCRAFT/dist/_steps-slice/s02-quotes.html'],
  ['s03-arrows', 'C:/BACKUPS/STILLLCRAFT/dist/_steps-slice/s03-arrows.html'],
  ['s04-leader', 'C:/BACKUPS/STILLLCRAFT/dist/_steps-slice/s04-leader.html'],
  ['s05-buttons', 'C:/BACKUPS/STILLLCRAFT/dist/_steps-slice/s05-buttons.html'],
  ['s06-flight-edges', 'C:/BACKUPS/STILLLCRAFT/dist/_steps-slice/s06-flight-edges.html'],
  ['s07-preloads', 'C:/BACKUPS/STILLLCRAFT/dist/_steps-slice/s07-preloads.html'],
  ['14-highlights (control)', 'C:/BACKUPS/STILLLCRAFT/dist/_steps/14-applyHighlightsFix.html'],
]) {
  await copyFile(src, base + '\\index.html');
  const page = await browser.newPage();
  let err = null;
  page.on('pageerror', e => { if (!err) err = (e.message || '').slice(0, 150); });
  await page.goto('http://localhost:3125/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);
  const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 30) : '(no)');
  const ok = body.startsWith('MENU');
  console.log(`${label.padEnd(22)} ${ok ? 'OK' : 'FAILED'} ${err ? '  ERR: ' + err : ''}`);
  await page.close();
}
await browser.close();