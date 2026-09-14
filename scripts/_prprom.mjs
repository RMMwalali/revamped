import fs from 'node:fs';
const g = fs.readFileSync('dist/index.html', 'utf8');
const pushes = [...g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)];
const dec = (a) => JSON.parse('"' + a + '"');
for (const m of pushes) {
  let t; try { t = dec(m[1]); } catch { continue; }
  const i = t.indexOf('"prominents":{"edges"');
  if (i < 0) continue;
  const start = t.indexOf('[', i);
  let depth = 0, j = start;
  while (j < t.length) { if (t[j] === '[' || t[j] === '{') depth++; else if (t[j] === ']' || t[j] === '}') { depth--; if (depth === 0) break; } j++; }
  const edges = JSON.parse(t.slice(start, j + 1));
  console.log('PROMINENTS COUNT', edges.length);
  edges.forEach((e, k) => {
    const n = e.node;
    console.log('--- slide', k, '---');
    console.log('keys', Object.keys(n).join(','));
    console.log('slug', n.slug, '| title', n.title);
    console.log('sourceUrl', (n.featuredImage || {}).node ? (n.featuredImage.node.sourceUrl || '') : (n.featuredImage || {}).sourceUrl);
    console.log('pic', n.pic, '| tabLabel', n.tabLabel, '| bookLabel', n.bookLabel);
  });
}
// ALSO: the home page <title> and corporate blocks
const s = g.slice(0, g.indexOf('self.__next_f.push('));
console.log('\nstatic title:', (s.match(/<title>([^<]*)<\/title>/) || [])[1]);
for (const k of ['ProjectStarter', 'prominentBlock', '"stats"', 'testimonials']) {
  const i = g.indexOf(k);
  console.log(k, i >= 0 ? '@' + i : 'abs');
}