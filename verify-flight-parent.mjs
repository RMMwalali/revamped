import { readFile } from 'node:fs/promises';
const t = await readFile('./dist/home/index.html', 'utf8');
const c = t.indexOf('"className":"styles_invention__bakTB"');
console.log('--- 600 chars before className:');
console.log(t.slice(Math.max(0, c - 600), c));
// find tuple open
const open = t.lastIndexOf('["$"', c);
console.log('--- tuple open at', open, 'head:', JSON.stringify(t.slice(open, open + 60)));
console.log('--- char before open:', JSON.stringify(t.slice(open - 30, open)));
