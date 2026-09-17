import { readFile } from 'node:fs/promises';
const t = await readFile('./dist/home/index.html', 'utf8');
let idx = -1, k = 0;
while ((idx = t.indexOf('styles_invention__bakTB', idx + 1)) >= 0 && k++ < 4) {
  console.log('=== occ', k, 'at', idx);
  console.log('BEFORE:', JSON.stringify(t.slice(Math.max(0, idx - 200), idx)));
  console.log('AFTER-START:', JSON.stringify(t.slice(idx, idx + 150)));
}
// how many __next_f pushes?
console.log('push count:', t.split('self.__next_f.push').length - 1);
// is there a u003c-div form of the block?
console.log('u003cdiv class=...invention:', t.split('u003cdiv class=\\u0026quot;styles_invention').length - 1);
console.log('u003cdiv count:', t.split('\\u003cdiv').length - 1);
