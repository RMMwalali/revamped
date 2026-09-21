import { readFile, writeFile } from 'node:fs/promises';
import { getInsightManifest, applyInsights } from './cms.mjs';
const man = await getInsightManifest();
const h = await readFile('dist/index.html', 'utf8');
// V1: reorder only
await writeFile('dist/_bisect-v1-reorder.html',
  applyInsights(h, { home: ['cphi-trade-show', 'iventions-london-hub', 'do-you-need-an-international-event-agency'], hidden: [], items: {} }, '/', man));
// V2: title only (no reorder, no hidden)
await writeFile('dist/_bisect-v2-title.html',
  applyInsights(h, { home: [], hidden: [], items: { 'cphi-trade-show': { title: 'CPHI Trade Show 2026 TEST TITLE' } } }, '/', man));
// V3: hidden only
await writeFile('dist/_bisect-v3-hide.html',
  applyInsights(h, { home: [], hidden: ['marketing-and-events'], items: {} }, '/', man));
console.log('wrote V1 V2 V3');
process.exit(0);
