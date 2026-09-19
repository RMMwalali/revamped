import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// find all "$L" refs and "$N" refs near row 41 region (295000-297800)
const seg = h.slice(294000, 298000);
const refs = {};
const m = seg.matchAll(/\\"(\$[0-9a-fA-F]{1,2}|@[0-9a-fA-F]+)\\"/g);
for (const x of m) refs[x[1]] = (refs[x[1]] || 0) + 1;
console.log('refs found near rows40-44:', JSON.stringify(refs));
// Show the parent row that contains children including the events band.
// In RSC, a parent row references children rows by number string like "$41".
// Search SRC served for "$41" raw anywhere (maybe not escaped quote context)
let c=-1,n=0; while((c=h.indexOf('"$41"',c+1))>=0)n++;
console.log('"$41" raw hits', n);
c=-1;n=0; while((c=h.indexOf('$41',c+1))>=0)n++;
console.log('$41 raw hits', n);
// Look at how rows 3e(services) 40(?) are referenced. Print the raw bytes with dollar refs visible in area 295000-296300
console.log(JSON.stringify(h.slice(295000, 296300)).slice(0, 4000));