const fs = require('fs');
const g = fs.readFileSync('dist/index.html', 'utf8');
const idx = [];
let i = -1;
while ((i = g.indexOf('logo', i + 1)) >= 0 && idx.length < 40) idx.push(i);
console.log('logo hits in home static+flight:', idx.length);
for (const j of idx) {
  const s = g.slice(Math.max(0, j - 120), j + 140).replace(/\s+/g, ' ');
  if (!/Stylesheet/.test(s)) console.log('...', s.slice(0, 200));
}