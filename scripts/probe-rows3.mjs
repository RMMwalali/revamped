import { readFile } from 'node:fs/promises';
// replicate internals: parse segs, merge, walk rows, report spans + whether insights edges inside
const BS = String.fromCharCode(92);
const TAGSET = new Set(['T', 'A', 'O', 'o', 'U', 'S', 's', 'L', 'l', 'G', 'g', 'M', 'm', 'V']);
const { default: x } = await import('node:util').catch(() => ({}));
void x;
const flight = await import('./flight.mjs');
void flight;
const h = await readFile('dist/insights/index.html', 'utf8');
// find edges arrays of interest (raw markers)
const markers = ['insightCategories', '"insights"', 'resourceData'];
for (const mk of markers) {
  let i = -1, n = 0;
  while ((i = h.indexOf(mk, i + 1)) > 0 && n < 6) { n++; if (n <= 3) console.log(mk, 'at raw', i); }
}
// Instead of reimplementing: use verifyFlight rows count + locate T rows via simple scan with lengths
const parts = h.split('self.__next_f.push(');
console.log('pushes:', parts.length - 1);
process.exit(0);
