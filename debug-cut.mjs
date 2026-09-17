import { readFile } from 'node:fs/promises';
const html = await readFile('./dist/index.html', 'utf8');
console.log('file len:', html.length);
console.log('marker count:', html.split('styles_invention__bakTB').length - 1);
const sOpen = html.indexOf('<div class="styles_invention__bakTB');
console.log('sOpen:', sOpen);
// balanced scan with diagnostics
let depth = 0, i = sOpen, steps = 0, maxDepth = 0;
let end = -1;
while (i < html.length) {
  if (html.startsWith('</div', i) && /[\s>]/.test(html[i + 5] || '')) {
    const gt = html.indexOf('>', i);
    if (gt < 0) { console.log('BAIL: no gt for close at', i); break; }
    depth--; i = gt + 1;
    if (depth === 0) { end = i; break; }
  } else if (html.startsWith('<div', i) && /[\s>]/.test(html[i + 4] || '')) {
    const gt = html.indexOf('>', i);
    if (gt < 0) { console.log('BAIL: no gt for open at', i, JSON.stringify(html.slice(i, i + 120))); break; }
    if (html[gt - 1] !== '/') depth++;
    maxDepth = Math.max(maxDepth, depth);
    i = gt + 1;
  } else { i++; }
  if (++steps > 4000000) { console.log('BAIL: too many steps at', i); break; }
}
console.log('end:', end, 'maxDepth:', maxDepth);
if (end > 0) {
  const span = html.slice(sOpen, end);
  console.log('span len:', span.length);
  console.log('has <script:', span.indexOf('<script') >= 0);
  console.log('span occurrences:', html.split(span).length - 1);
  console.log('--- span tail:', JSON.stringify(span.slice(-200)));
}
