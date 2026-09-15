import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
const BS = String.fromCharCode(92);
function parseSeg(seg) {
  const m = /^\[(\d+),"/.exec(seg);
  if (!m) return null;
  let i = m[0].length;
  while (i < seg.length) {
    if (seg[i] === BS) { i += 2; continue; }
    if (seg[i] === '"') break;
    i++;
  }
  return { content: seg.slice(m[0].length, i) };
}
const joined = parts.slice(1).map((p) => parseSeg(p).content).join('');
console.log('joined len:', joined.length);
const h = joined.indexOf('47:T1226,');
console.log('header at', h);
console.log('around:', JSON.stringify(joined.slice(h - 20, h + 60)));
// manual walk with debug: count bytes, show where we land vs expectation
import('./flight.mjs').then(() => {});
// replicate walk inline with tracing of first mismatch area: find next raw \n after payload start
const ps = h + '47:T1226,'.length;
console.log('payload head:', JSON.stringify(joined.slice(ps, ps + 80)));
process.exit(0);
