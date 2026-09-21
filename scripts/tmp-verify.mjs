import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {verifyFlight} from './flight.mjs';
const OLD = ['6e38258f27e823dd', '94cd094f4a3e8f0a', '7172-1942429eed9ac7e3', '8809-c4e3ac275ea670ca', '39444cf470c387d5', '1086f123f968dd96'];
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}
let stale = 0, badFiles = 0, rows = 0, n = 0;
for (const f of walk('dist')) {
  n++;
  const t = readFileSync(f, 'utf8');
  const flat = t.split('self.__next_f.push(').join('');
  for (const o of OLD) if (flat.includes(o)) { console.log('STALE:', f, o); stale++; }
  const v = verifyFlight(t);
  rows += v.rows;
  if (v.bad > 0) { badFiles++; console.log('BAD', v.bad, f); }
}
console.log(`files=${n} rows=${rows} stale=${stale} badFiles=${badFiles}`);
