import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// search all occurrences for candidate identifiers
const ids = ['participants', 'industry', 'eventType', 'EVENT TYPE', 'event type', 'Slider', 'SEE FULL', 'HIGH-PERFORMANCE', 'highPerformance', 'caseStudy', 'CaseStudy'];
for (const k of ids) {
  const idxs = [];
  let i = -1;
  while ((i = h.indexOf(k, i + 1)) >= 0) idxs.push(i);
  console.log(k, '=>', idxs.length, idxs.slice(0, 8));
}
// find the chunk list in served html
const ci = h.indexOf('_next/static/chunks');
console.log('\nchunks idx', ci);
if (ci >= 0) console.log(JSON.stringify(h.slice(Math.max(0, ci - 200), ci + 900)));
const si = h.indexOf('<script');
console.log('\nfirst script', si);
console.log(JSON.stringify(h.slice(si, si + 800)));