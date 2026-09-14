import fs from 'node:fs';
const g = fs.readFileSync('dist/index.html', 'utf8');
const s = g.slice(0, g.indexOf('self.__next_f.push('));
for (const k of ['Designed to be remembered', 'Highlight projects', 'Our Latest', 'prominent']) {
  let c = 0;
  const hits = [];
  let i = -1;
  while ((i = s.toLowerCase().indexOf(k.toLowerCase(), i + 1)) >= 0 && c < 6) { hits.push(i); c++; }
  console.log(k, '->', c, hits);
}
// bigger: what's the component wrapping the first 'Highlight projects' at ~1005xx?
const base = g.indexOf('Highlight projects');
console.log('\n===== 1200 before first Highlight projects =====');
console.log(JSON.stringify(g.slice(base - 1200, base)));
console.log('\n===== 40 before to 700 after =====');
console.log(JSON.stringify(g.slice(base - 40, base + 700)));