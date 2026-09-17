import { readFile } from 'node:fs/promises';
const html = await readFile('./dist/index.html', 'utf8');
const first = html.indexOf('styles_invention__bakTB');
const second = html.indexOf('styles_invention__bakTB', first + 1);
console.log('first:', first, 'second:', second);
const seg = html.slice(second - 80, second);
console.log('codes:', [...seg].map((c) => (c === '\\' ? 'BS' : c === '"' ? 'DQ' : c === '\n' ? 'NL' : c)).join(''));
