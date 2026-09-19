import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
for (const i of [281239, 281287, 296103]) {
  console.log('\n--- idx', i, '---');
  console.log(JSON.stringify(h.slice(i - 160, i + 420)));
}
// find where the events slider client component gets its prop in the hPa chunk
const t = fs.readFileSync('dist/_next/static/chunks/3930-5a2b1ec52287565c.js', 'utf8');
const def = t.indexOf('default:()=>ei');
// find references to the data path used by ei (the events slider)
const i2 = t.indexOf('testimonialTemplate');
console.log('\nchunk ei around:', JSON.stringify(t.slice(def - 400, def + 200)));
// home chunk: find "data.S" prop for events slider / testimonials
const home = fs.readFileSync('C:/Users/SERENI~1/AppData/Local/Temp/opencode/page-home.js', 'utf8');
for (const k of ['eventSlider', 'eventsSlider', 'data.', '.testimonials', 'testimonial', 'caseStudies', 'SEE FULL CASE STUD']) {
  const idx = home.indexOf(k);
  console.log('home:', k, idx, idx >= 0 ? JSON.stringify(home.slice(Math.max(0, idx - 120), idx + 120)) : '');
}