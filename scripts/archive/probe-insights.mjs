import { readFile } from 'node:fs/promises';
const h = await readFile('dist/insights/index.html', 'utf8');
const p = h.split('self.__next_f.push(');
for (let i = 1; i < p.length; i++) {
  const m = p[i].match(/"total":(\d+)/);
  if (m) console.log('push', i, 'total=' + m[1], 'len', p[i].length);
}
const BS = String.fromCharCode(92);
const EBS = BS + BS;
const re = new RegExp(BS + '"slug' + BS + '":' + BS + '"([a-z0-9-]+)' + BS + '",' + BS + '"title' + BS + '":' + BS + '"((?:' + EBS + '.|[^' + EBS + ']){0,80})', 'g');
let i = 0, m;
while ((m = re.exec(h))) {
  if (i < 10) console.log(m[1], '::', m[2].slice(0, 60));
  i++;
}
console.log('slug+title pairs:', i);
process.exit(0);
