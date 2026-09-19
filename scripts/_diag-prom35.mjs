import fs from 'fs';
const t = fs.readFileSync('dist/_next/static/chunks/3930-5a2b1ec52287565c.js', 'utf8');
// find where the module 10883 default is bound. Look for `ei=` (function or const) near module body
const mStart = t.indexOf('10883:(');
console.log('module start', mStart);
// search for 'ei=' and 'function ei' and '.default')
for (const k of ['ei=', 'ei(', 'rp', 'r.d(t,{default:']) {
  const hs=[]; let i=-1; while((i=t.indexOf(k,i+1))>=0) hs.push(i);
  console.log(k, hs.filter(x=>x>mStart).slice(0,8));
}
// Print from module end: find '},10884' after mStart
const next = t.indexOf('},10884:', mStart);
console.log('module end', next);
console.log('module length', next - mStart);
// print last 2500 chars of module
console.log(JSON.stringify(t.slice(next - 2600, next)));