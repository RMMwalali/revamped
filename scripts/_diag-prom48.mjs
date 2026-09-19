import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
const s = h.indexOf('\\n3c:');
console.log('=== 3c..45 DECODED ===');
console.log(h.slice(s, s + 9000).replace(/\\n/g, '\n').replace(/\\"/g, '"').slice(0, 9000));