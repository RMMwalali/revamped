import fs from 'fs';
import { findEdgesArrays, splitTopObjects, splitTopArrays, matchBracketRaw } from './flight.mjs';
const BS = String.fromCharCode(92);
const FQ = BS + '"';
let h = fs.readFileSync('dist/_steps/34-applyFooterFix.html', 'utf8');

function homeInsightEdgeCount(html) {
  for (const a of findEdgesArrays(html)) {
    const inner = html.slice(a.start + 1, a.end - 1);
    const nodes = splitTopObjects(inner);
    if (nodes.length < 1) continue;
    const first = inner.slice(nodes[0].start, nodes[0].end);
    if (!first.includes('insightTemplate')) continue;
    if (nodes.length > 6) continue;
    return nodes.length;
  }
  return 0;
}

const count = homeInsightEdgeCount(h);
console.log('home edge count:', count);
const gi = h.indexOf('styles_bottom__ivX84');
const cellStart = h.indexOf('children' + FQ + ':[', gi);
const cellsOpen = cellStart + ('children' + FQ + ':[').length;
const cellsEnd = matchBracketRaw(h, cellsOpen);
const inner = h.slice(cellsOpen + 1, cellsEnd - 1);
const spans = splitTopArrays(inner);
console.log('cell spans:', spans.length);
for (const s of spans) console.log(' cell', JSON.stringify(inner.slice(s.start, Math.min(s.end, s.start + 130))));
// rebuild like the sync helper
const keep = spans.slice(0, count);
const rebuilt = keep.map((s, i) => {
  let cell = inner.slice(s.start, s.end);
  const reNum = /(edges:)\d+/.exec(cell);
  if (reNum) cell = cell.slice(0, reNum.index) + reNum[1] + i + cell.slice(reNum.index + reNum[0].length);
  const reIdx = new RegExp(BS + '"' + 'index' + BS + '"' + ':\\d+').exec(cell);
  if (reIdx) cell = cell.slice(0, reIdx.index) + '\\\"index\\\":' + i + cell.slice(reIdx.index + reIdx[0].length);
  return cell;
});
h = h.slice(0, cellsOpen + 1) + rebuilt.join(',') + h.slice(cellsEnd - 1);
// verify no dangling edges:N beyond count remain in the cells group
const after = h.slice(gi);
const reflist = [...after.matchAll(/insights:edges:(\d+)/g)].map((m) => m[1]);
console.log('refs after sync:', reflist.join(','), '=> max', Math.max(...reflist.map(Number)), 'count-1', count - 1);
// show rebuilt cells group
const gi2 = h.indexOf('styles_bottom__ivX84');
const cs2 = h.indexOf('children' + FQ + ':[', gi2);
const co2 = cs2 + ('children' + FQ + ':[').length;
const ce2 = matchBracketRaw(h, co2);
console.log('cells group head:', JSON.stringify(h.slice(co2, Math.min(ce2, co2 + 420))));