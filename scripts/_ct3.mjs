import fs from 'node:fs';
const g = fs.readFileSync('scripts/_aftercount.html', 'utf8');
console.log('len', g.length);
// find occurrences of the swapped strings and inspect around
for (const m of g.matchAll(/>71<\/div>/g)) console.log('left >71</div> @', m.index);
for (const m of g.matchAll(/>12<\/div>/g)) console.log('>12</div> @', m.index, JSON.stringify(g.slice(m.index - 80, m.index + 12)));
// find footer3 fragment start
const fi = g.indexOf('get you accurate');
console.log('footer text @', fi, JSON.stringify(g.slice(fi - 60, fi + 40)));
const fi2 = g.indexOf('"3:');
console.log('"3:" id @', fi2);