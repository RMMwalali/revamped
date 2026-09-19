import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// find all hideTestimonial occurrences
const hits = [];
let i = -1;
while ((i = h.indexOf('hideTestimonial', i + 1)) >= 0) hits.push(i);
console.log('hideTestimonial hits', hits);
for (const hi of hits) {
  console.log('\n', JSON.stringify(h.slice(hi - 260, hi + 120)));
}
// where is testimonials:[] with $L ref - find the events band mount
// search page-home source for the events slider usage & hideTestimonial
const home = fs.readFileSync('C:/Users/SERENI~1/AppData/Local/Temp/opencode/page-home.js', 'utf8');
for (const k of ['hideTestimonial', 'testimonialBlock', 'EventSlider', 'ei(', '10883', 'SEE FULL CASE', 'eventSlider']) {
  const hits2 = [];
  let j = -1;
  while ((j = home.indexOf(k, j + 1)) >= 0) hits2.push(j);
  console.log('home:', k, '=>', hits2.length, hits2.slice(0, 8));
}