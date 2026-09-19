import fs from 'fs';
const t = fs.readFileSync('dist/_next/static/chunks/3930-5a2b1ec52287565c.js', 'utf8');
const mStart = t.indexOf('10883:(');
// find "default:()=>ei" occurrence
const d = t.indexOf('default:()=>ei', mStart);
console.log('default decl at', d);
console.log(JSON.stringify(t.slice(d - 60, d + 60)));
// find ei definition: search 'ei=' near after r.d? Actually module pattern: ...exports;var ei=...  Let's find 'ei=' above.
const ei = t.indexOf('ei=', d + 100);
console.log('ei= after decl?', ei);
// print between d and d+4000 to see if ei is defined right after r.d(...) 
console.log(JSON.stringify(t.slice(d, d + 5000)));