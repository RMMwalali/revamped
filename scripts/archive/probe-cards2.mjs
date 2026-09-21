import { readFile } from 'node:fs/promises';
const BS = String.fromCharCode(92);
const FQ = BS + '"';
// home card block
let h = await readFile('dist/index.html', 'utf8');
let stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
let i = stat.indexOf('/insight/iventions-london-hub');
console.log('=== HOME card static:');
console.log(JSON.stringify(stat.slice(i - 200, i + 900)).slice(0, 1300));
// insights card block
h = await readFile('dist/insights/index.html', 'utf8');
stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
i = stat.indexOf('/insight/marketing-and-events');
console.log('=== INSIGHTS card static:');
console.log(JSON.stringify(stat.slice(i - 200, i + 1200)).slice(0, 1600));
// detail date display
h = await readFile('dist/insight/cphi-trade-show/index.html', 'utf8');
stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
const dm = stat.match(/20\d\d[-./]\d\d[-./]\d\d|\d\d\.\d\d\.\d\d|[A-Z][a-z]+ \d{1,2}, 20\d\d/);
console.log('=== CPHI detail date-ish:', dm ? dm[0] : 'none');
// flight date values on insights page
h = await readFile('dist/insights/index.html', 'utf8');
const dates = [...h.matchAll(/detailBlock.{0,40}date.{0,60}/g)].slice(0, 3);
for (const d of dates) console.log('flight date ctx:', JSON.stringify(d[0]).slice(0, 140));
process.exit(0);
