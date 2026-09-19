import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// Find a real child-row reference: search for the pattern \;?N: after a row with children arrays
// Convert path to show raw escaped flight area from row 0x38 to 0x46 (hex: 38..46)
const keys = ['38:','39:','3a:','3b:','3c:','3d:','3e:','3f:','40:','41:','42:','43:','44:','45:','46:'];
const frac = h.indexOf('30-5a2b1ec52287565c.js\\",');
// the hidden start of rows: around here
const start = h.indexOf('\\n38:');
console.log('38 start', start);
let s = start != null ? start : 0;
console.log(h.slice(s, s + 400).replace(/\\\\/g,'\\').replace(/\\"/g,'"').replace(/\\n/g,'\n'));