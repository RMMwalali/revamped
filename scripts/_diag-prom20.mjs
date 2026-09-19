import fs from 'fs';
const t = fs.readFileSync('dist/_next/static/chunks/3930-5a2b1ec52287565c.js', 'utf8');
for (const k of ['hideTestimonial', 'hide', 'testimonials', 'edges', 'newPr']) {
  const hits = [];
  let i = -1;
  while ((i = t.indexOf(k, i + 1)) >= 0) hits.push(i);
  console.log(k, '=>', hits.length, hits.slice(0, 10));
}
// find module 10883 (ei default) fully
const mStart = t.indexOf('10883:');
const seg = t.slice(mStart);
console.log('\n--- 10883 module (first 6000 chars) ---');
console.log(JSON.stringify(seg.slice(0, 6000)));