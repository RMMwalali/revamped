import fs from 'fs';
const t = fs.readFileSync('dist/_next/static/chunks/3930-5a2b1ec52287565c.js', 'utf8');
const mStart = t.indexOf('10883:(');
// where does module end? search for the module wrapper closing '})' plus next module id pattern
// find "ei=" and print the whole function - likely large. Print 30000 chars.
const ei = t.indexOf('ei=', mStart);
console.log('ei= at', ei);
console.log(JSON.stringify(t.slice(ei, ei + 30000)));