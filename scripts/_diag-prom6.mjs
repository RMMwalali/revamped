import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// count occurrences of various ref patterns to see which the served html actually uses
const checks = {
  itemVal: (h.match(/\{\"item\":\"[^\"]*?\"/g) || []).length,
  edgesAny: (h.match(/edges:\d+/g) || []).length,
  lead: (h.match(/"item":\$4/g) || []).length,
  dolL: (h.match(/\$L\d+/g) || []).length,
  promEdges0: (h.match(/prominents:edges:0/g) || []).length,
  promEdges1: (h.match(/prominents:edges:1/g) || []).length,
  promEdges2: (h.match(/prominents:edges:2/g) || []).length,
};
console.log(checks);
// show a raw sample around first edges:N occurrence (non-flight? it's in flight payload)
const i = h.indexOf('edges:0');
console.log(JSON.stringify(h.slice(i - 140, i + 60)));
// search for cell-type structure with edgesN in any quoting style
const re = /\[\"\$\",\"\$L\d+\",\"[^\"]*?\",\{\"item\":\"[^\"]*?\"/g;
let m, n = 0;
while ((m = re.exec(h))) { n++; if (n <= 3) console.log('CELL', JSON.stringify(m[0])); }
console.log('cell-like matches:', n);