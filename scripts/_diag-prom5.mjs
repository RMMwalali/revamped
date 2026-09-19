import fs from 'fs';
import { findEdgesArrays, splitTopObjects } from './flight.mjs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// all item refs in flight rows pointing into some edges array
const re = /\{\"item\":\"([^\"]*?:edges:\d+)\"/g;
const refs = [];
let m;
while ((m = re.exec(h))) refs.push(m[1].split(':').slice(-5).join(':'));
console.log('edges item refs:', refs.length, refs.slice(0, 50));
// any refs into prominents
for (const r of refs) if (r.includes('prominent')) console.log('PROM', r);
// count each edges array node count + marker
for (const a of findEdgesArrays(h)) {
  const inner = h.slice(a.start + 1, a.end - 1);
  const nodes = splitTopObjects(inner);
  if (!nodes.length) continue;
  console.log('arr', nodes.length, JSON.stringify(a.marker.slice(-44)));
}