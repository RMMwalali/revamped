import { readFile, writeFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
function mapPushes(html, fn) {
  const p = html.split('self.__next_f.push(');
  for (let i = 1; i < p.length; i++) p[i] = fn(p[i], i);
  return p.join('self.__next_f.push(');
}
const needle = 'https://iventions.com/contact?form=contact';
// C: absolute different host, same shape
await writeFile('dist/_bisect-g06C-abshost.html', mapPushes(html, (s, i) => (i === 24 ? s.split(needle).join('https://example.com/contact?form=contact') : s)));
// D: relative but with leading hash kept absolute-ish? use protocol-relative
await writeFile('dist/_bisect-g06D-protorel.html', mapPushes(html, (s, i) => (i === 24 ? s.split(needle).join('//example.com/contact?form=contact') : s)));
console.log('ok');
process.exit(0);
