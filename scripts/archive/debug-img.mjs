import { readFile } from 'node:fs/promises';
const html = await readFile('dist/index.html', 'utf8');
const re = /<img[^>]*>/g;
let m, count = 0;
console.log('TOTAL img tags:', (html.match(/<img/g) || []).length);
while ((m = re.exec(html)) && count < 8) {
  const t = m[0];
  const src = (t.match(/src="([^"]*)/) || [])[1];
  const srcset = (t.match(/srcset="([^"]*)/) || [])[1];
  console.log('---');
  console.log('SRC:', src);
  console.log('SRCSET:', srcset ? srcset.slice(0, 250) : '(none)');
  count++;
}
