import { readFile, writeFile } from 'node:fs/promises';
import { getInsightManifest, applyInsights } from './cms.mjs';
import { verifyFlight } from './flight.mjs';
const man = await getInsightManifest();
const h = await readFile('dist/index.html', 'utf8');
const cfg = {
  home: ['cphi-trade-show', 'iventions-london-hub', 'marketing-and-events'],
  hidden: [],
  items: {
    'cphi-trade-show': { title: 'CPHI Trade Show 2026 TEST TITLE' },
    'marketing-and-events': { title: 'Marketing And Events TEST' },
  },
};
const out = applyInsights(h, cfg, '/', man);
console.log('verify:', JSON.stringify(verifyFlight(out)));
const stat = out.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
const links = [...stat.matchAll(/href="\/insight\/([a-z0-9-]+)"/g)].map((m) => m[1]);
console.log('static links:', links.join(','));
console.log('static new titles:', (stat.match(/CPHI Trade Show 2026 TEST TITLE|Marketing And Events TEST/g) || []).length);
await writeFile('dist/_bisect-ins-add.html', out);
process.exit(0);
