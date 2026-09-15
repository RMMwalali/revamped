import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
console.log('segments:', parts.length - 1);
// inspect seg 23 (0-based parts index 23 = 23rd push) tail
const s23 = parts[23];
console.log('seg23 tail:', JSON.stringify(s23.slice(-120)));
// check the exact bytes around 47:T1226
const i = s23.indexOf('47:T1226,');
console.log('found at', i, JSON.stringify(s23.slice(i - 30, i + 40)));
// what does the merged join look like at that junction?
const m1 = s23.match(/^\[(\d+),"/);
console.log('seg23 prefix match:', m1 ? m1[0] : null);
process.exit(0);
