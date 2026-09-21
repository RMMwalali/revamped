import { readFile } from 'node:fs/promises';
import { findEdgesArrays, splitTopObjects } from './flight.mjs';
const listing = await readFile('dist/insights/index.html', 'utf8');
const arrs = findEdgesArrays(listing);
console.log('arrays found:', arrs.length);
for (const a of arrs.slice(0, 12)) {
  const inner = listing.slice(a.start + 1, a.end - 1);
  const nodes = splitTopObjects(inner);
  const first = nodes.length ? inner.slice(nodes[0].start, nodes[0].end) : '';
  console.log('nodes:', nodes.length, 'hasInsightTemplate:', first.includes('insightTemplate'), 'hasSlug:', first.includes('slug'), 'marker:', JSON.stringify(a.marker.slice(-60)));
}
process.exit(0);
