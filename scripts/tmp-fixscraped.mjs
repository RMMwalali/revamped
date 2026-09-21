// One-off: scraped/ is the build source (rebuild.mjs regenerates dist/ from it
// on every Vercel deploy), but still carries pre-rename chunk refs — wiping
// the dist fixes each deploy. Apply the same flight-aware same-length swaps.
import {readFileSync, writeFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {verifyFlight} from './flight.mjs';

const BS = String.fromCharCode(92);
const PAIRS = [
  ['7051-6e38258f27e823dd.js', '7051-f39c5f36163b0072.js'],
  ['7051-94cd094f4a3e8f0a.js', '7051-f3ed6d5164f253fc.js'],
  ['7172-1942429eed9ac7e3.js', '7172-4db4616175fc1cb4.js'],
  ['8809-c4e3ac275ea670ca.js', '8809-786367b29b78465e.js'],
  ['page-39444cf470c387d5.js', 'page-309422970545a739.js'],
  ['page-1086f123f968dd96.js', 'page-fd9d75e5d0bdf437.js'],
];
for (const [a, b] of PAIRS) {
  if (a.length !== b.length) throw new Error('length mismatch ' + a);
}
function parseSeg(seg) {
  const m = /^\[(\d+),"/.exec(seg);
  if (!m) return null;
  let i = m[0].length;
  while (i < seg.length) {
    if (seg[i] === BS) { i += 2; continue; }
    if (seg[i] === '"') break;
    i++;
  }
  if (i >= seg.length) return null;
  return {prefix: seg.slice(0, m[0].length), content: seg.slice(m[0].length, i), suffix: seg.slice(i)};
}
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}
const delim = 'self.__next_f.push(';
let touched = 0;
for (const f of walk('scraped')) {
  const html = readFileSync(f, 'utf8');
  if (!html.includes(delim)) continue;
  const probe = html.split(delim).slice(1).map((p) => {
    const s = parseSeg(p);
    return s ? s.content : null;
  });
  if (probe.some((s) => s === null)) continue;
  const joined = probe.join('');
  if (!PAIRS.some(([a]) => joined.includes(a))) continue;
  const v0 = verifyFlight(html);
  let content = joined;
  for (const [a, b] of PAIRS) content = content.split(a).join(b);
  const parts = html.split(delim);
  const segs = parts.slice(1).map((p) => parseSeg(p));
  let out = parts[0] + delim + segs[0].prefix + content + segs[0].suffix;
  for (let k = 1; k < segs.length; k++) out += delim + segs[k].prefix + '' + segs[k].suffix;
  const v1 = verifyFlight(out);
  const same = v1.bad === v0.bad && v1.rows === v0.rows;
  console.log((same ? 'fixed: ' : 'SKIP: ') + f, JSON.stringify(v0), '->', JSON.stringify(v1));
  if (same) { writeFileSync(f, out); touched++; }
}
console.log('touched', touched);
