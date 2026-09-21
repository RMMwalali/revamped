import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
const s = parts[24];
console.log('push24 raw len:', s.length);
console.log('HEAD:', JSON.stringify(s.slice(0, 120)));
console.log('TAIL:', JSON.stringify(s.slice(-300)));
// find all row-id-like patterns  ^hex:  after \n escapes
const re = /\\n([0-9a-f]+):/g;
let m, ids = [];
while ((m = re.exec(s))) ids.push(m[1]);
console.log('row ids in push24:', [...new Set(ids)].join(','));
process.exit(0);
