import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// Find parent container that references rows 40,41,42,44. Try escaped "$41" with various quote forms
for (const q of ['"$41"','"$40"','"$44"','"$49"','"$4"']) {
  const hits=[]; let i=-1;
  while ((i=h.indexOf(q,i+1))>=0) hits.push(i);
  console.log(JSON.stringify(q), hits.length, hits.slice(0,8));
}
// Recover actual characters: file contains \u to represent quotes. Print raw bytes around row-41 start to see delimiter format
const raw = Buffer.from(h, 'latin1');
const p = raw.indexOf(Buffer.from('40:[', 'latin1'));
console.log('40:[ raw at', p);
// find the chars before 40: to see the separator
console.log(JSON.stringify(raw.slice(p-260, p+60).toString('latin1')));
// Search for 'children' arrays under pages: find where $L28 container includes these rows.
// Instead grep for the string that precedes "events" band section: "see what we create" in flight
for (const m of ['See what we create','SEE FULL CASE','see full case','css-jp7bfh','Bringing together audiences']) {
  const hs=[]; let i=-1; while((i=h.indexOf(m,i+1))>=0) hs.push(i);
  console.log(m, hs.slice(0,10));
}