import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// 1) what static content sits immediately before css-5ohagv (band start) 
console.log('--- 500 chars before band css-5ohagv (192165) ---');
console.log(JSON.stringify(h.slice(191665, 192165)));
// 2) what "Bringing together audiences" looks like & its index
const bta = h.indexOf('Bringing together audiences');
console.log('BTA at', bta);
console.log(JSON.stringify(h.slice(bta - 120, bta + 160)));
// 3) contents in the 87KB band region - count key markers
const seg = h.slice(192165, bta);
console.log('\nband region length', seg.length);
for (const m of ['caseStud', 'case-stud', 'CASE STUD', 'participants', 'SEE FULL', 'Bringing', 'caseStudy', 'quote', 'section', 'Partners', 'Our Clients', 'Client', 'WORK', 'Would you']) {
  console.log(m, (seg.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length);
}
// 4) find the flight mount: search for 'testimonials":[]' and '41:'
console.log('\ntestimonials":[] at', h.indexOf('testimonials":"'), h.indexOf('testimonials":[]'));
// search refs to row 41
for (const m of ['"$41"','"$42"','"41:"','"42:"']) {
  const hits=[];let i=-1;while((i=h.indexOf(m,i+1))>=0)hits.push(i);
  console.log(m, hits);
}