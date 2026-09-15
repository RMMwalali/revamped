import { readFile, writeFile } from 'node:fs/promises';
import { getInsightManifest, applyInsights } from './cms.mjs';
import { verifyFlight } from './flight.mjs';
const man = await getInsightManifest();
const bySlug = new Map(man.map((m) => [m.slug, m]));
// test: home order swap (cphi first), hide one, retitle cphi
const cfg = {
  home: ['cphi-trade-show', 'iventions-london-hub', 'do-you-need-an-international-event-agency'],
  hidden: ['marketing-and-events'],
  items: {
    'cphi-trade-show': { title: 'CPHI Trade Show 2026 TEST TITLE' },
    'iventions-london-hub': { title: 'StillCraft London Hub TEST' },
  },
};
for (const [f, page] of [['dist/index.html', '/'], ['dist/insights/index.html', '/insights']]) {
  const h = await readFile(f, 'utf8');
  const v0 = verifyFlight(h);
  const out = applyInsights(h, cfg, page, man);
  const v1 = verifyFlight(out);
  console.log(f, 'rows', JSON.stringify(v0), '->', JSON.stringify(v1));
  console.log('  new title present:', out.includes('CPHI Trade Show 2026 TEST TITLE'));
  console.log('  hidden gone from flight:', !out.includes('marketing-and-events'));
  console.log('  hidden gone static:', !out.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('').includes('marketing-and-events'));
  await writeFile('dist/_bisect-ins-' + (page === '/' ? 'home' : 'insights') + '.html', out);
}
// detail page title edit
{
  const h = await readFile('dist/insight/cphi-trade-show/index.html', 'utf8');
  const out = applyInsights(h, cfg, '/insight/cphi-trade-show', man);
  console.log('detail verify:', JSON.stringify(verifyFlight(out)), 'title:', out.includes('CPHI Trade Show 2026 TEST TITLE'));
  await writeFile('dist/_bisect-ins-detail.html', out);
}
process.exit(0);
