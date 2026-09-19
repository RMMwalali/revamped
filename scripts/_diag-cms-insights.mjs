import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_ROOT = join(process.cwd(), 'dist');
const html = await readFile(join(DIST_ROOT, '_steps', '34-applyFooterFix.html'), 'utf8');

const countInsights = (label, h) => {
  const needle = String.raw`insights\":{\"edges\":[`;
  const i = h.indexOf(needle);
  console.log(label, 'needle idx', i);
  if (i < 0) return;
  const open = h.indexOf('[', i);
  let depth = 0, end = -1;
  for (let k = open; k < h.length; k++) {
    const ch = h[k];
    if (ch === '\\') { k++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (!depth) { end = k; break; } }
  }
  const inner = h.slice(open + 1, end - 1);
  const dbs = [...inner.matchAll(/\\"databaseId\\":(\d+)/g)];
  const slugs = [...inner.matchAll(/\\"slug\\":\\"([^\\"]+)\\"/g)];
  console.log(label, 'nodes=', dbs.length, 'slugs=', JSON.stringify(slugs.map((m) => m[1])));
};
countInsights('RAW ', await readFile(join(DIST_ROOT, 'index.html'), 'utf8'));
countInsights('STEP', html);

// How many circle paint cells reference insight edges in the final html
const cells = [...html.matchAll(String.raw`\"item\":\"\$4:1:props:children:0:props:data:home:page:homePage:insightsBlock:insights:edges:(\d+)\"`.replace(/\\r\\n/g, '\\n'))];
console.log('circle cells refs edges indices:', JSON.stringify(cells.map((m) => m[1])));

// Find the module for AnimatedCircle / circle carousel (u component) mapping edges
const pageChunk = await readFile(join(DIST_ROOT, 'assets', 'root', '_next', 'static', 'chunks', 'app', '(withQuoteContact)', 'page-2f419b88353d9d34.js'), 'utf8');
console.log('pageChunk len', pageChunk.length);
const kws = ['comment.insertBefore', 'edges.forEach', '.edges.map(', 'o.edges', 'reviewNodes', 'intro'];
for (const kw of kws) {
  const i = pageChunk.indexOf(kw);
  console.log(kw, i);
}