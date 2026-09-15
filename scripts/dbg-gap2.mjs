import { readFile } from 'node:fs/promises';
const h = await readFile('dist/index.html', 'utf8');
const stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
// replicate: find anchors then containers, print container bounds
const reH = /<a\s[^>]*href="\/insight\/([a-z0-9-]+)"[^>]*>/g;
let m;
while ((m = reH.exec(stat))) {
  console.log('anchor', m[1], 'at', m.index);
}
// container starts
const reC = /<div\s[^>]*class="styles_item__OXawi[^"]*"[^>]*>/g;
while ((m = reC.exec(stat))) console.log('container at', m.index);
process.exit(0);
