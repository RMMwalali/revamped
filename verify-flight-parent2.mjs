import { readFile } from 'node:fs/promises';
const t = await readFile('./dist/home/index.html', 'utf8');
const needle = '\\"className\\":\\"styles_invention__bakTB\\"';
const c = t.indexOf(needle);
console.log('className at:', c);
console.log('--- 400 before:', JSON.stringify(t.slice(c - 400, c)));
const openNeedle = '[\\"$$\\",\\"div\\",null,{\\"className\\"';
const open = t.lastIndexOf('[\\"', c);
// find tuple start: walk back to the nearest '["$"' equivalent: [\"$\",
const tup = t.lastIndexOf('[\\"$\\",\\"div\\",null,{\\"className\\"', c);
console.log('tuple open at:', tup);
if (tup >= 0) console.log('head:', JSON.stringify(t.slice(tup, tup + 80)));
if (tup >= 0) console.log('char before open:', JSON.stringify(t.slice(tup - 40, tup)));
