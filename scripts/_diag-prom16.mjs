import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
for (const k of ['testimonials', 'testimonialBlock', 'eventsBlock:', 'events:', 'upcomingBlock:', 'caseStudies', 'caseStudiesBlock']) {
  const hits = [];
  let i = -1;
  while ((i = h.indexOf(k, i + 1)) >= 0) hits.push(i);
  console.log(k, '=>', hits.length, hits.slice(0, 10));
}
// check the region of the events band in flight: find what block descriptor precedes css-5ohagv SSR
const idx = h.indexOf('css-5ohagv');
// go backwards to find the nearest flight marker
console.log('\nbefore css-5ohagv:', JSON.stringify(h.slice(idx - 900, idx + 40)));