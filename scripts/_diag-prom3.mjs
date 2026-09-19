import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// $Lxx cells with item refs into edges arrays: ["$","$L53","title",{"item":"$4:...:edges:N","index":N}]
const re = /\[\"\$\",\"\$L\d+\",\"([^\"]{0,40})\",\{\"item\":\"([^\"]*?:edges:\d+)\",\"index\":\d+\}\]/g;
const cells = [];
let m;
while ((m = re.exec(h))) {
  cells.push({ title: m[1].slice(0, 50), ref: m[2].split(':').slice(-4).join(':') });
}
console.log('item-ref cells:', cells.length);
for (const c of cells.slice(0, 40)) console.log('  ', c.ref, JSON.stringify(c.title));
// any cell referencing prominents
const prom = cells.filter((c) => c.ref.includes('prominent'));
console.log('prominent cells:', prom.length);
// find edges array whose marker mentions prominent
import { findEdgesArrays, splitTopObjects } from './flight.mjs';
const arrs = findEdgesArrays(h).filter((a) => a.marker.includes('-project') || a.marker.includes('project') || a.marker.includes('prominent'));
console.log('project/prominent edges arrays:', arrs.length);
for (const a of arrs) {
  const inner = h.slice(a.start + 1, a.end - 1);
  const nodes = splitTopObjects(inner);
  console.log('  nodes', nodes.length, JSON.stringify(a.marker.slice(-50)));
}