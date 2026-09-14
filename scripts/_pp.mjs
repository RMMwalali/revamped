import fs from 'node:fs';
const g = fs.readFileSync('dist/index.html', 'utf8');
const pushes = [...g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)];
const dec = (a) => JSON.parse('"' + a + '"');
for (const m of pushes) {
  let t; try { t = dec(m[1]); } catch { continue; }
  const i = t.indexOf('"prominents":{"edges"');
  if (i < 0) continue;
  const st = t.indexOf('[', i);
  let d = 0, j = st;
  while (j < t.length) { if (t[j] === '[' || t[j] === '{') d++; else if (t[j] === ']' || t[j] === '}') { d--; if (d === 0) break; } j++; }
  const edges = JSON.parse(t.slice(st, j + 1));
  edges.forEach((e, k) => {
    const n = e.node;
    const src = (n.featuredImage && n.featuredImage.node && n.featuredImage.node.sourceUrl) || (n.featuredImage && n.featuredImage.sourceUrl) || n.sourceUrl || '?';
    console.log(k, n.slug, '|', n.title, '|', src);
  });
}