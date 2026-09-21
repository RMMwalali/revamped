import { readFile } from 'node:fs/promises';
const h = await readFile('dist/insights/index.html', 'utf8');
const BS = String.fromCharCode(92);
const FQ = BS + '"';
// find edges arrays containing insight nodes (with databaseId + slug, no title adjacency assumed)
let idx = 0, n = 0;
while ((idx = h.indexOf(FQ + 'edges' + FQ + ':[', idx + 1)) > 0 && n < 40) {
  const seg = h.slice(idx, idx + 700);
  if (seg.includes('databaseId') && seg.includes('slug') && !seg.includes('projectCategories')) {
    n++;
    if (n <= 4) console.log('--- ctx', n, JSON.stringify(seg.slice(0, 500)));
  }
}
console.log('done');
process.exit(0);
