import { readFile } from 'node:fs/promises';
const html = await readFile('./dist/index.html', 'utf8');
// find className marker without assuming escape style
const i0 = html.indexOf('styles_invention__bakTB');
console.log('plain marker at:', i0);
// show raw char codes of the 60 chars before it
const seg = html.slice(i0 - 60, i0);
console.log('codes:', [...seg].map((c) => (c === '\\' ? 'BS' : c === '"' ? 'DQ' : c)).join(''));
