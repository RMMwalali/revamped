import { findEdgesArrays, splitTopObjects } from './flight.mjs';
import fs from 'fs';
const h = fs.readFileSync('dist/_steps/34-applyFooterFix.html', 'utf8');
let short = 0;
for (const a of findEdgesArrays(h)) {
  const inner = h.slice(a.start + 1, a.end - 1);
  const nodes = splitTopObjects(inner);
  if (!nodes.length) continue;
  const first = inner.slice(nodes[0].start, nodes[0].end);
  if (!first.includes('insightTemplate')) continue;
  console.log('nodes=' + nodes.length, JSON.stringify(a.marker.slice(-70)));
  if (nodes.length <= 6) short++;
}
console.log('short arrays:', short);