import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
for (const ref of ['\\"$3d\\"','\\"$c\\"','\\"$e\\"','\\"$1\\"']) {
  let i=-1; const hs=[];
  while((i=h.indexOf(ref,i+1))>=0) hs.push(i);
  console.log(ref, hs);
  for (const x of hs.slice(0,3)) console.log('   ctx', JSON.stringify(h.slice(x-160,x+120)));
}
// find the big container: search for '"We are proud to have worked with"' parent chain. 
// Rows 40-44: they are consecutive. Where do they attach? find '$40' or row id references as "$40" in hex = "$28"? 
// Actually Next.js uses hex row ids. 40 in hex = 64 decimal. Refs "$40". But none found. 
// Maybe the parent uses an array of row-ids: ["$3e","$3f","$40","$41","$42","$43","$44"] - but not found!
// Search for the partners row attach: who references 3f?
let i=-1; const hs=[];
while((i=h.indexOf('partners\\", t.index))) ;
// Simply print raw region just after row 4-5 to see the root array structure that references sections
console.log('--- root rows region ---');
console.log(JSON.stringify(h.slice(h.indexOf('\\n1:')-50, h.indexOf('\\n4:')+100)).slice(0,2500));