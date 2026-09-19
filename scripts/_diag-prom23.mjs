import fs from 'fs';
const t = fs.readFileSync('dist/_next/static/chunks/3930-5a2b1ec52287565c.js', 'utf8');
const start = t.indexOf('10883:(');
// print the tail of module 10883: find "default:()=>ei" definition inside module body
const eidx = t.indexOf('let ei', start);
const eifull = t.indexOf('let ei=');
console.log('let ei at', eifull);
if (eifull >= 0) {
  // print 4000 chars from there
  console.log(JSON.stringify(t.slice(eifull, eifull + 5000)));
}