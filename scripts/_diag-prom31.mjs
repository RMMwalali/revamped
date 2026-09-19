import fs from 'fs';
const src = fs.readFileSync('dist/index.html', 'utf8');
const s = src.indexOf('css-5ohagv');
// print the src band full region up to ~4000 chars
console.log(JSON.stringify(src.slice(s, s + 4200)));