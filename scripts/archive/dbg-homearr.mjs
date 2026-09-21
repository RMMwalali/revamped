import { readFile } from 'node:fs/promises';
import { findEdgesArrays, splitTopObjects } from './flight.mjs';
const h = await readFile('dist/_bisect-ins-home.html', 'utf8');
for (const a of findEdgesArrays(h)) {
  const inner = h.slice(a.start + 1, a.end - 1);
  const nodes = splitTopObjects(inner);
  if (!nodes.length) continue;
  const first = inner.slice(nodes[0].start, nodes[0].end);
  if (!first.includes('insightTemplate')) continue;
  console.log('ARRAY with', nodes.length, 'nodes');
  for (const nd of nodes) {
    const ns = inner.slice(nd.start, nd.end);
    const slug = (/"slug":"([^"\\]+)"/.exec(ns) || [])[1];
    // validate braces balance (string-aware-ish: count raw braces minus escaped?)
    console.log(' -', slug, 'len', ns.length);
  }
  // try JSON.parse on decoded node?
  const n0 = inner.slice(nodes[0].start, nodes[0].end);
  console.log('first node head:', JSON.stringify(n0.slice(0, 200)));
}
process.exit(0);
