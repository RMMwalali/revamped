import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
const start = h.indexOf('css-5ohagv');
const end = h.indexOf('Bringing together audiences');
console.log('start', start, 'end', end);
const band = h.slice(start, end);
console.log('band length', band.length);
for (const m of ['css-1w327c', 'css-zme24x', 'css-lvtjah', 'css-12ybk68', 'css-41c6dw', 'css-jp7bfh', 'css-qg5m4o', 'css-h3wi0l', 'css-woa673', 'css-ctko3l', 'css-3rlusp', 'css-9nnxn7', 'alt="Leader"', 'css-t8q91a', 'css-olu4sz', 'css-woye']) {
  console.log(m.padEnd(16), band.includes(m), band.indexOf(m));
}
console.log('\nBAND:', JSON.stringify(band.slice(0, 2600)));