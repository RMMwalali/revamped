import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// raw substring "$41" inside escaped json = \"$41\" -> look for \s*"$41" general
for (const m of ['$41','$42','$49']) {
  const hits = [];
  let i = -1;
  while ((i = h.indexOf(m, i + 1)) >= 0) hits.push(i);
  console.log(m, hits.length, hits.slice(0, 15));
  for (const hi of hits.slice(0, 2)) console.log('  ctx', JSON.stringify(h.slice(hi - 40, hi + 40)));
}
// Count how many "testimonials" appear in full file
let c = -1, n = 0; while ((c = h.indexOf('testimonials', c+1)) >= 0) n++;
console.log('testimonials count', n);