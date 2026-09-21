const fs = require('fs');
const g = fs.readFileSync('dist/_pristine-index.html', 'utf8');
const s = g.slice(0, g.indexOf('self.__next_f.push('));
for (const k of ['/project/uefa', '/project/', 'href="/project']) {
  let c = 0, i = -1;
  const h = [];
  while ((i = s.indexOf(k, i + 1)) >= 0 && c < 8) { h.push(i); c++; }
  console.log(k, '->', c, h);
}
const i = s.indexOf('/project/uefa');
if (i >= 0) console.log('ctx', JSON.stringify(s.slice(Math.max(0, i - 250), i + 150)));
// also check the prominents side list anchor structure: find 'Highlight projects'
const j = s.indexOf('Highlight projects');
if (j >= 0) console.log('promctx', JSON.stringify(s.slice(j - 300, j + 800)));