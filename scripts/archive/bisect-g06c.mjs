import { readFile, writeFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
function mapPushes(html, fn) {
  const p = html.split('self.__next_f.push(');
  for (let i = 1; i < p.length; i++) p[i] = fn(p[i], i);
  return p.join('self.__next_f.push(');
}
const needle = 'https://iventions.com/contact?form=contact';
// E: same byte length, still absolute (iventions (9) -> stillcraf (9))
await writeFile('dist/_bisect-g06E-samelen.html', mapPushes(html, (s, i) => (i === 24 ? s.split(needle).join('https://stillcraf.com/contact?form=contact') : s)));
// F: single word change elsewhere in article text, same length
await writeFile('dist/_bisect-g06F-word.html', mapPushes(html, (s, i) => (i === 24 ? s.split('London hub is not about').join('London hub is nix about') : s)));
console.log('lengths:', needle.length, 'https://stillcraf.com/contact?form=contact'.length);
process.exit(0);
