import { readFile } from 'node:fs/promises';

const src = await readFile('dist/assets/root/_next/static/chunks/vendors-27161c75-1ac32bdba4aff7a0.js', 'utf8');
const idx = src.indexOf('_fromJSON');
const key = src.indexOf('_fromJSON:function');
console.log('_fromJSON at', idx, 'key at', key);
// _fromJSON is used in P(e) as r._fromJSON. Find definition by scanning backwards for its object property.
const def = src.indexOf('_fromJSON:function(');
console.log('def index', def);
if (def >= 0) console.log(src.slice(def, def + 5000));
else {
  // maybe v._fromJSON or r._fromJSON
  console.log(src.slice(idx - 300, idx + 300));
}