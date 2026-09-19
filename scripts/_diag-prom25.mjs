import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// find "\n41:[..." but lines are \n-escaped? Print around 296103 with real newlines
const start = h.indexOf('\\n41:') >= 0 ? h.indexOf('\\n41:') : h.indexOf('\n41:');
console.log('\\n41 at', start);
// print raw chars
const seg = h.slice(295900, 300700);
console.log(seg.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'));