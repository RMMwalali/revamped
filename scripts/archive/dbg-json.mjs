import { readFile } from 'node:fs/promises';
import { findEdgesArrays, splitTopObjects } from './flight.mjs';
const BS = String.fromCharCode(92);
function jsDecode(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\"/g, '"').replace(/\\\\/g, '\0').split('\0').join(BS);
}
for (const f of ['dist/_bisect-ins-home.html', 'dist/index.html']) {
  const h = await readFile(f, 'utf8');
  for (const a of findEdgesArrays(h)) {
    const inner = h.slice(a.start + 1, a.end - 1);
    const nodes = splitTopObjects(inner);
    if (!nodes.length) continue;
    const first = inner.slice(nodes[0].start, nodes[0].end);
    if (!first.includes('insightTemplate')) continue;
    if (nodes.length !== 3) continue;
    console.log('===', f, 'nodes:', nodes.length);
    const dec = jsDecode('[' + inner + ']');
    try {
      const arr = JSON.parse(dec);
      console.log('JSON OK, slugs:', arr.map((n) => n.node && n.node.slug).join(','));
    } catch (e) {
      console.log('JSON PARSE FAIL:', String(e).slice(0, 200));
      // find first divergence vs original
    }
  }
}
process.exit(0);
