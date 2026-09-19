import fs from 'fs';
import path from 'path';
const h = fs.readFileSync('dist/_served.html', 'utf8');
let i = -1;
const hits = [];
while ((i = h.indexOf('3930-5a2b1ec52287565c', i + 1)) >= 0) hits.push(i);
console.log('3930 refs in served', hits);
for (const hi of hits) console.log(JSON.stringify(h.slice(hi - 140, hi + 80)));
// locate all copies of the chunk file in dist
const copies = [];
(function walk(dir){
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.includes('3930-5a2b1ec52287565c')) copies.push(p);
  }
})('dist');
console.log('chunk copies', copies);