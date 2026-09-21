import { readFile } from 'node:fs/promises';
const h = await readFile('dist/index.html', 'utf8');
const stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
// find home card divs
const re = /<div\s[^>]*class="styles_item__OXawi[^"]*"[^>]*>/g;
let m; const starts = [];
while ((m = re.exec(stat))) starts.push(m.index);
console.log('home cards:', starts.length);
// show gap between card 1 end-ish and card 2: find </div> chains — instead print raw between starts
for (let i = 0; i < starts.length - 1; i++) {
  const seg = stat.slice(starts[i], starts[i + 1]);
  console.log('gap tail before next card:', JSON.stringify(seg.slice(-160)));
}
process.exit(0);
