import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// Search for escaped \"$41\" and \"$L49\" etc
for (const m of ['\\"$41\\"','\\"$L49\\"','\\"$L48\\"','\\"$L4a\\"','\\"$L4b\\"','\\"$L50\\"']) {
  const hits=[]; let i=-1; while((i=h.indexOf(m,i+1))>=0)hits.push(i);
  console.log(m, hits);
}
// The flight starts: find "self.__next_f.push" or the big payload. Print start of flight rows.
const rowsStart = h.indexOf('1:');
console.log('\nfirst rows ctx', JSON.stringify(h.slice(h.indexOf('\\n1:'), h.indexOf('\\n1:')+200)));
// Count lines that look like N:["$"
const m = h.match(/\\n(\d+):\[\\"\\\$\\",/g);
console.log('flight rows count', m ? m.length : -1);
// The main page row: find where top-level children come from: search "props:children" big array assemble
console.log('first $4:1 ref', h.indexOf('\\"$4:1'));
console.log(JSON.stringify(h.slice(h.indexOf('\\"$4:1')-200, h.indexOf('\\"$4:1')+200)));