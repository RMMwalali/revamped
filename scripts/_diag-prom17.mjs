import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
const start = h.indexOf('css-5ohagv');
const end = h.indexOf('We are proud to have worked with');
const band = h.slice(start, end);
console.log('band length', band.length);
for (const m of ['UEFA', 'Pfizer', 'CordenPharma', 'Menzies', 'Midas', 'Adevinta', 'Iventions delivered excellent', 'EventSliderActions', 'css-lvtjah', 'css-12ybk68', 'css-41c6dw', 'css-jp7bfh', 'alt="Leader"']) {
  console.log(m.padEnd(30), band.includes(m), band.indexOf(m));
}
// what marks remain
console.log('\nLeader/img region tail:', JSON.stringify(band.slice(-500)));