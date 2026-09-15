import { readFile } from 'node:fs/promises';
let h = await readFile('dist/index.html', 'utf8');
let stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
// home card: find styles_item__OXawi block for london-hub, show img + date area
let i = stat.indexOf('styles_item__OXawi');
console.log('=== HOME card full block (first 2600 chars):');
console.log(JSON.stringify(stat.slice(i - 60, i + 2600)).slice(0, 2800));
h = await readFile('dist/insights/index.html', 'utf8');
stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
i = stat.indexOf('/insight/marketing-and-events');
const block = stat.slice(i, i + 4000);
// find date-ish and category-ish text after the link
const tail = block.slice(block.indexOf('</figure>'), block.indexOf('</figure>') + 2200);
console.log('=== INSIGHTS card after figure:');
console.log(JSON.stringify(tail).slice(0, 2400));
process.exit(0);
