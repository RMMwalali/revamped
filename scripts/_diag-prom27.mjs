import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// escaped forms used in _served.html. Print surrounding of '\n41:'
const p = h.indexOf('\\n41:');
console.log('escaped row 41 at', p);
console.log(JSON.stringify(h.slice(p - 300, p + 220)));
// how is it referenced? search for literal "$41" in the raw file (should exist unescaped in the flight payload JSON chunk?)
let i = -1; const hits = [];
while ((i = h.indexOf('$41', i + 1)) >= 0) hits.push(i);
console.log('$41 raw hits', hits.slice(0, 20));
for (const hi of hits.slice(0,3)) console.log('  ctx', JSON.stringify(h.slice(hi-90, hi+60)));