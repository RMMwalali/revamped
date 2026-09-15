import { readFile, writeFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
// Variant A: localize everything EXCEPT push#24's content link
let hA = html;
// Variant B: localize ONLY the content link in push#24
// Do it by operating per-push index.
function mapPushes(html, fn) {
  const p = html.split('self.__next_f.push(');
  for (let i = 1; i < p.length; i++) p[i] = fn(p[i], i);
  return p.join('self.__next_f.push(');
}
// A: skip push index 24 (1-based in parts array? parts[0] is pre-first-push; push#24 in my log was i=24 in parts indexing)
const vA = mapPushes(html, (s, i) => (i === 24 ? s : s.split('https://iventions.com/').join('/')));
await writeFile('dist/_bisect-g06A-nocontent.html', vA);
const vB = mapPushes(html, (s, i) => (i === 24 ? s.split('https://iventions.com/').join('/') : s));
await writeFile('dist/_bisect-g06B-onlycontent.html', vB);
console.log('ok');
process.exit(0);
