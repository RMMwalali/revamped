import { readFileSync } from 'node:fs';
const files = ['C:/BACKUPS/STILLLCRAFT/dist/index.html', 'C:/BACKUPS/STILLLCRAFT/dist/_steps/34-applyFooterFix.html'];
for (const f of files) {
  const c = readFileSync(f, 'utf8');
  const refs = [...c.matchAll(/insightsBlock:insights:edges:(\d+)/g)];
  const grouped = {};
  for (const m of refs) {
    const k = m[1];
    grouped[k] = (grouped[k] || 0) + 1;
  }
  console.log(f.split('/').pop(), 'edges:N refs', JSON.stringify(grouped));
  const ins = [...c.matchAll(/\"insights\":\{\"edges\":\[/g)].length;
  console.log('  edges arrays:', ins);
}
const raw = readFileSync('C:/BACKUPS/STILLLCRAFT/dist/index.html', 'utf8');
// find the $L53 circle cells in raw
const cellStart = raw.indexOf('insights:edges:0');
console.log('\n=== RAW cell region ===');
console.log(raw.slice(cellStart - 400, cellStart + 900));