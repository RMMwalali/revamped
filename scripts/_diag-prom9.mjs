import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
const src = fs.readFileSync('dist/index.html', 'utf8');
for (const k of ['css-5ohagv', 'css-qg5m4o', 'participants', 'industry', 'eventType', 'jsonSliders', 'Sliders', 'sliderData', 'eventsData', 'projects', 'PROJECTS']) {
  const a = h.indexOf(k);
  const b = src.indexOf(k);
  console.log(k.padEnd(14), 'served', a, a >= 0 ? JSON.stringify(h.slice(a - 40, a + 60)) : '');
}
console.log('\nsrc only:');
for (const k of ['participants', 'industry', 'EVENT TYPE', 'event type', 'SEE FULL CASE', 'css-5ohagv']) {
  const b = src.indexOf(k);
  console.log(k.padEnd(14), b, b >= 0 ? JSON.stringify(src.slice(Math.max(0, b - 60), b + 60)) : '');
}