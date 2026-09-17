import { readFile } from 'node:fs/promises';
const BS = String.fromCharCode(92);
const DQ = String.fromCharCode(34);
const t = await readFile('./scripts/transform.mjs', 'utf8');
const lines = t.split('\n');
for (const [i, l] of lines.entries()) {
  if (l.indexOf('fMark') >= 0 || l.indexOf('fOpen') >= 0 || l.indexOf('fhead') >= 0 || l.indexOf('fEnd') >= 0) {
    console.log((i + 1) + ' codes: ' + [...l].map((c) => (c === BS ? 'BS' : c === DQ ? 'DQ' : c)).join(''));
  }
}
