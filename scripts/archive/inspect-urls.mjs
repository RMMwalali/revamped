import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
let total = 0;
const ctx = new Map();
for (let i = 1; i < parts.length; i++) {
  const re = /https:\/\/iventions\.com\//g;
  let m;
  while ((m = re.exec(parts[i]))) {
    total++;
    const s = parts[i].slice(Math.max(0, m.index - 60), m.index + 90).replace(/\n/g, ' ');
    const key = s.slice(0, 40);
    ctx.set(key, (ctx.get(key) || 0) + 1);
    if (ctx.size <= 25) console.log(`push#${i}: ...${s}...`);
  }
}
console.log('total flight occurrences:', total);
process.exit(0);
