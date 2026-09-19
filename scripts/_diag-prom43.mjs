import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// find all distinct "$XX" refs in the whole file (in escaped quotes context)
const m = h.matchAll(/\\"(\$[0-9a-fA-F]{1,3})\\"/g);
const refs = {};
for (const x of m) refs[x[1]] = (refs[x[1]] || 0) + 1;
console.log('distinct $ refs:', Object.keys(refs).sort((a,b)=>a.length-b.length||a.localeCompare(b)).length);
console.log('sample:', Object.entries(refs).sort((a,b)=>b[1]-a[1]).slice(0,40));
// check refs to 40,41,42
for (const r of ['$3f','$40','$41','$42','$44']) console.log(r, refs[r] || 0);
// Are row definitions numbered in hex? print all row defs
const defs = [];
const dm = h.matchAll(new RegExp(String.raw`\\n([0-9a-f]+):\\[\\"` , 'g'));
for (const d of dm) defs.push(d[1]);
console.log('row defs (hex-ish):', defs.join(','));
// Find where the top-level children point. The events band row 41 will be referenced from some parent.
// Search raw file for ',$41' pattern or equivalents
for (const pat of ['"$41"', '[$41]', ',$41,', ':"$41"']) {
  let c=-1,n=0; while((c=h.indexOf(pat,c+1))>=0)n++;
  console.log(JSON.stringify(pat), n);
}