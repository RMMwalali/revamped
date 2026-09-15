import { readFile } from 'node:fs/promises';
import { findEdgesArrays, splitTopObjects } from './flight.mjs';
const h = await readFile('dist/index.html', 'utf8');
for (const a of findEdgesArrays(h)) {
  const inner = h.slice(a.start + 1, a.end - 1);
  const nodes = splitTopObjects(inner);
  if (!nodes.length) continue;
  const first = inner.slice(nodes[0].start, nodes[0].end);
  if (!first.includes('insightTemplate')) continue;
  console.log('nodes:', nodes.length);
  for (const nd of nodes) {
    const ns = inner.slice(nd.start, nd.end);
    const slug = ns.split('\\"slug\\":\\"')[1]?.split('\\"')[0];
    const ci = ns.indexOf('\\"content\\":\\"');
    console.log('-', slug, 'content head:', JSON.stringify(ns.slice(ci + 14, ci + 120)));
  }
}
process.exit(0);
