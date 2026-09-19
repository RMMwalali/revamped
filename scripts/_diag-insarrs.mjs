import { readFileSync } from 'node:fs';
const c = readFileSync('C:/BACKUPS/STILLLCRAFT/dist/_steps/34-applyFooterFix.html', 'utf8');

// Find all flight "model" edges arrays containing insightTemplate
function findEdgesArrays(h) {
  const out = [];
  const marker = String.raw`insights\":{\"edges\":[`;
  let i = 0;
  while ((i = h.indexOf(marker, i)) >= 0) {
    const open = h.indexOf('[', i);
    let depth = 0, end = -1;
    for (let k = open; k < h.length; k++) {
      const ch = h[k];
      if (ch === '\\') { k++; continue; }
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (!depth) { end = k; break; } }
    }
    out.push({ start: open, end, inner: h.slice(open + 1, end - 1) });
    i = end + 1;
  }
  return out;
}
const arrs = findEdgesArrays(c);
console.log('edges arrays found:', arrs.length);
arrs.forEach((a, idx) => {
  const n = [...a.inner.matchAll(/\\"databaseId\\":(\d+)/g)].length;
  const slugs = [...a.inner.matchAll(/\\"slug\\":\\"([^\\"]+)\\"/g)].map((m) => m[1]);
  console.log(' arr', idx, 'nodes=', n, 'slugs=', JSON.stringify(slugs));
});

// Circle cells referencing insight edges
console.log('\ninsight edges:* refs:', JSON.stringify([...c.matchAll(/insightsBlock:insights:edges:(\d+)/g)].map((m) => m[1])));