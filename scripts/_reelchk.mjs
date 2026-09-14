import { readFileSync } from 'node:fs';
const h = readFileSync('dist/index.html', 'utf8');
const i = h.indexOf('reelUrl');
console.log('first reelUrl raw context:');
console.log(JSON.stringify(h.slice(Math.max(0, i - 60), i + 160)));
const j = h.indexOf('reelMobileUrl');
console.log('\nfirst reelMobileUrl raw context:');
console.log(JSON.stringify(h.slice(Math.max(0, j - 60), j + 160)));
console.log('\ncount reelUrl:', (h.match(/reelUrl/g) || []).length, ' reelMobileUrl:', (h.match(/reelMobileUrl/g) || []).length);