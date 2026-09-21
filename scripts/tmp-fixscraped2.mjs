// Pass 2 for scraped/: contiguous refs in static markup (script tags, tails).
import {readFileSync, writeFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {safeReplacePairs, verifyFlight} from './flight.mjs';
const PAIRS = [
  ['7051-6e38258f27e823dd.js', '7051-f39c5f36163b0072.js'],
  ['7051-94cd094f4a3e8f0a.js', '7051-f3ed6d5164f253fc.js'],
  ['7172-1942429eed9ac7e3.js', '7172-4db4616175fc1cb4.js'],
  ['8809-c4e3ac275ea670ca.js', '8809-786367b29b78465e.js'],
  ['page-39444cf470c387d5.js', 'page-309422970545a739.js'],
  ['page-1086f123f968dd96.js', 'page-fd9d75e5d0bdf437.js'],
];
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}
let touched = 0;
for (const f of walk('scraped')) {
  const before = readFileSync(f, 'utf8');
  if (!PAIRS.some(([a]) => before.includes(a))) continue;
  const v0 = verifyFlight(before);
  const after = safeReplacePairs(before, PAIRS);
  const v1 = verifyFlight(after);
  const same = v1.bad === v0.bad && v1.rows === v0.rows;
  console.log((same ? 'fixed: ' : 'SKIP: ') + f);
  if (same) { writeFileSync(f, after); touched++; }
}
console.log('touched', touched);
