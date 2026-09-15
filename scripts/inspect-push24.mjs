import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
const s = parts[24];
const i = s.indexOf('iventions.com/contact');
console.log(JSON.stringify(s.slice(i - 400, i + 200)));
console.log('---push start---');
console.log(JSON.stringify(s.slice(0, 300)));
process.exit(0);
