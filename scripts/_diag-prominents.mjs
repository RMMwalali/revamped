import { findEdgesArrays, splitTopObjects } from './flight.mjs';
import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
const i = h.indexOf('prominents');
console.log('prominents idx', i, JSON.stringify(h.slice(i - 80, i + 30)));
for (const a of findEdgesArrays(h)) {
  if (!a.marker.includes('prominent')) continue;
  const inner = h.slice(a.start + 1, a.end - 1);
  const nodes = splitTopObjects(inner);
  console.log('prominent nodes:', nodes.length);
  const first = inner.slice(nodes[0].start, nodes[0].end);
  console.log('first node head:', JSON.stringify(first.slice(0, 400)));
}