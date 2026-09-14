import { readFileSync } from 'node:fs';
const h = readFileSync('dist/index.html', 'utf8');
const i = h.indexOf('reelUrl');
console.log('RAW (not json-encoded) around reelUrl:');
console.log(JSON.stringify(h.slice(i, i + 240)));
const j = h.indexOf('reelMobileUrl');
console.log('\nRAW around reelMobileUrl:');
console.log(JSON.stringify(h.slice(j, j + 240)));
// find end of both URLs (up to next escaped quote)
function grab(key) {
  const k = h.indexOf(key);
  if (k < 0) return null;
  const start = h.indexOf('https', k);
  const end = h.indexOf('\\"', start);
  return h.slice(start, end);
}
console.log('\nreelUrl value:', grab('reelUrl'));
console.log('reelMobileUrl value:', grab('reelMobileUrl'));