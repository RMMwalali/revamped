import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// print exact raw bytes around row 40 definition and its parent container references
function show(where, label, len) {
  console.log('\n=== ' + label + ' @ ' + where + ' ===');
  console.log(h.slice(where, where + len).replace(/\\n/g, '\nLINE:\n').replace(/\\"/g, '"'));
}
show(h.indexOf('\\n40:') - 400, 'BEFORE row40', 700);
console.log('\n\n=== raw char codes near "$" of row 40 line start ===');
const p = h.indexOf('\\n40:');
console.log(JSON.stringify(h.slice(p - 30, p + 5)));