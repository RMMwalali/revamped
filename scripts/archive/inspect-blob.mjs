import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
const s = parts[24];
// find start of the article blob
const i = s.indexOf('Q: London is a highly');
console.log('BEFORE:', JSON.stringify(s.slice(i - 500, i)));
process.exit(0);
