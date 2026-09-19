import { readFile } from 'node:fs/promises';

const html = await readFile('dist/index.html', 'utf8');
const BS = String.fromCharCode(92);
const FQ = BS + '"';
const key = FQ + 'partners' + FQ + ':[';
let idx = html.indexOf(key);
console.log('partners idx:', idx);
if (idx >= 0) {
  const open = idx + key.length - 1;
  let depth = 0, end = -1;
  for (let k = open; k < html.length; k++) {
    const ch = html[k];
    if (ch === BS) { k++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = k; break; } }
  }
  const from = Math.max(0, idx - 250);
  console.log('---context (raw, backslashes as \\x7f)---');
  const seg = html.slice(from, Math.min(html.length, end + 350));
  console.log(seg.split(BS).join(`\x1b[31m\\\x1b[0m`));
  const inner = html.slice(open + 1, end);
  let nodes = 0, d2 = 0, s2 = open + 1;
  for (let q = open + 1; q < end; q++) {
    const ch = html[q];
    if (ch === BS) { q++; continue; }
    if (ch === '{') { if (d2 === 0) s2 = q; d2++; }
    else if (ch === '}') { d2--; if (d2 === 0) nodes++; }
  }
  console.log('\ntop-level nodes:', nodes, 'inner length:', inner.length);
} else {
  const key2 = '"partners":[';
  console.log('plain-quote partners idx:', html.indexOf(key2));
}

// Also count how many times the key appears and near-what
let count = 0, i = 0;
while ((i = html.indexOf(key, i)) >= 0) { count++; i += key.length; }
console.log('partners key occurrences:', count);
const kk = '"partners":[';
count = 0; i = 0;
while ((i = html.indexOf(kk, i)) >= 0) { count++; i += kk.length; }
console.log('plain quotes-ish occurrences:', count);