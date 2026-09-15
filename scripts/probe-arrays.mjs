import { readFile } from 'node:fs/promises';
const BS = String.fromCharCode(92);
const FQ = BS + '"';
for (const f of ['dist/insights/index.html', 'dist/index.html']) {
  const h = await readFile(f, 'utf8');
  console.log('=====', f);
  // find all `edges:[` and classify by first 600 chars
  let idx = 0, n = 0;
  const seen = new Map();
  while ((idx = h.indexOf(FQ + 'edges' + FQ + ':[', idx + 1)) > 0) {
    const seg = h.slice(idx, idx + 420);
    const hasSlugTitle = seg.includes(FQ + 'slug' + FQ) && seg.includes(FQ + 'title' + FQ);
    const key = h.slice(Math.max(0, idx - 120), idx).replace(/^.*([a-zA-Z]{3,20}(\\?"?:?)?)$/, '$1');
    const k = (hasSlugTitle ? 'LIST?' : 'other') + ' :: ' + JSON.stringify(h.slice(Math.max(0, idx - 90), idx)).slice(-100);
    seen.set(k, (seen.get(k) || 0) + 1);
    n++;
    if (n > 200) break;
  }
  for (const [k, c] of seen) console.log(c + 'x', k);
}
process.exit(0);
