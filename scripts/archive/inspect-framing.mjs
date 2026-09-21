import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
console.log('push count:', parts.length - 1);
// show the raw start of several pushes (first 200 chars each) to see row framing
for (const n of [1, 2, 3, 6, 24]) {
  console.log(`--- push ${n} head ---`);
  console.log(JSON.stringify(parts[n].slice(0, 220)));
}
process.exit(0);
