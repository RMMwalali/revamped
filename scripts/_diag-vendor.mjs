import { readFile } from 'node:fs/promises';

const src = await readFile('dist/assets/root/_next/static/chunks/vendors-27161c75-1ac32bdba4aff7a0.js', 'utf8');
console.log('len', src.length);
for (const needle of ['$$typeof', '_fromJSON']) {
  let i = src.indexOf(needle);
  console.log('---', needle, 'first at', i, '---');
  console.log(src.slice(Math.max(0, i - 1600), i + 2000));
  break;
}